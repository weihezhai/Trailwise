import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { SessionSummary, TraceEvent, WorkflowTrace } from "@trailwise/shared";
import { validateTrace } from "@trailwise/shared";
import type { DevHelperConfig } from "./config.js";
import type { BackendSession } from "./backend-client.js";

export interface ActiveSession {
  session_id: string;
  target_url: string;
  started_at: string;
  session_directory: string;
  screenshots_enabled: boolean;
}

export class TraceStore {
  readonly sessionsDir: string;
  readonly activePath: string;

  constructor(private readonly config: DevHelperConfig) {
    this.sessionsDir = join(config.dataDir, "sessions");
    this.activePath = join(config.dataDir, "active-session.json");
    mkdirSync(this.sessionsDir, { recursive: true });
  }

  start(session: BackendSession): ActiveSession {
    const startedAt = new Date().toISOString();
    const sessionDirectory = join(this.sessionsDir, session.session_id);
    mkdirSync(join(sessionDirectory, "screenshots"), { recursive: true });
    mkdirSync(join(sessionDirectory, "dom"), { recursive: true });
    mkdirSync(join(sessionDirectory, "generated"), { recursive: true });

    const active: ActiveSession = {
      session_id: session.session_id,
      target_url: session.target_url,
      started_at: startedAt,
      session_directory: sessionDirectory,
      screenshots_enabled: this.config.screenshotsEnabled
    };

    const trace: WorkflowTrace = {
      schema_version: "0.1",
      session_id: session.session_id,
      platform: "macos",
      browser: "chrome",
      started_at: startedAt,
      target_url: session.target_url,
      events: [
        {
          seq: 1,
          type: "session_started",
          ts: 0,
          url: session.target_url,
          value_policy: "none"
        }
      ]
    };

    this.writeJson(this.tracePath(active), trace);
    this.writeJson(this.activePath, active);
    this.writeJson(join(sessionDirectory, "metadata.json"), {
      session_id: session.session_id,
      target_url: session.target_url,
      started_at: startedAt
    });
    return active;
  }

  activeSession(): ActiveSession | undefined {
    if (!existsSync(this.activePath)) return undefined;
    return JSON.parse(readFileSync(this.activePath, "utf8")) as ActiveSession;
  }

  append(input: Partial<TraceEvent>): TraceEvent | undefined {
    const active = this.activeSession();
    if (!active) return undefined;
    if (!this.urlAllowed(input.url, active.target_url)) return undefined;

    const trace = this.readTrace(active);
    const ts = normalizeTimestamp(input.ts, trace.started_at);
    const event = sanitizeEvent({
      seq: trace.events.length + 1,
      type: input.type ?? "click",
      ts,
      url: input.url,
      title: input.title,
      selector: input.selector,
      role: input.role,
      label: input.label,
      text: input.text,
      screenshot: input.screenshot,
      value_policy: input.value_policy,
      value: input.value,
      element: input.element
    } as TraceEvent);

    if (active.screenshots_enabled && shouldCapture(event)) {
      event.screenshot = this.capturePlaceholderScreenshot(active, event);
    }

    trace.events.push(event);
    this.writeValidatedTrace(active, trace);
    return event;
  }

  finalize(cancelled = false, options: { videoPath?: string } = {}): SessionSummary {
    const active = this.activeSession();
    if (!active) throw new Error("No active session to finalize");
    const trace = this.readTrace(active);
    const duration = elapsedMs(trace.started_at);
    trace.stopped_at = new Date().toISOString();
    trace.duration_ms = duration;
    if (options.videoPath) {
      trace.video_path = options.videoPath;
    }
    trace.events.push({
      seq: trace.events.length + 1,
      type: cancelled ? "session_cancelled" : "session_stopped",
      ts: duration,
      url: lastUrl(trace),
      value_policy: "none"
    });
    this.writeValidatedTrace(active, trace);
    rmSync(this.activePath, { force: true });

    return {
      session_id: active.session_id,
      duration_ms: duration,
      url_start: trace.target_url,
      url_end: lastUrl(trace),
      events_count: trace.events.filter((event) => !["session_started", "session_stopped", "session_cancelled"].includes(event.type)).length,
      screenshots_count: trace.events.filter((event) => event.screenshot).length,
      redactions_count: trace.events.filter((event) => event.value_policy === "redacted").length,
      trace_path: this.tracePath(active),
      video_path: options.videoPath
    };
  }

  delete(sessionId: string): void {
    rmSync(join(this.sessionsDir, sessionId), { recursive: true, force: true });
    const active = this.activeSession();
    if (active?.session_id === sessionId) rmSync(this.activePath, { force: true });
  }

  private readTrace(active: ActiveSession): WorkflowTrace {
    return JSON.parse(readFileSync(this.tracePath(active), "utf8")) as WorkflowTrace;
  }

  private tracePath(active: ActiveSession): string {
    return join(active.session_directory, "trace.json");
  }

  private writeValidatedTrace(active: ActiveSession, trace: WorkflowTrace): void {
    const result = validateTrace(trace);
    if (!result.valid) throw new Error(`Trace validation failed: ${result.errors.join("; ")}`);
    this.writeJson(this.tracePath(active), trace);
  }

  private writeJson(path: string, value: unknown): void {
    mkdirSync(resolve(path, ".."), { recursive: true });
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  }

  private urlAllowed(eventUrl: string | undefined, targetUrl: string): boolean {
    if (!eventUrl) return true;
    const event = new URL(eventUrl);
    const target = new URL(targetUrl);
    return event.origin === target.origin;
  }

  private capturePlaceholderScreenshot(active: ActiveSession, event: TraceEvent): string {
    const relativePath = `screenshots/${String(event.seq).padStart(6, "0")}-${event.type}.txt`;
    const absolute = join(active.session_directory, relativePath);
    writeFileSync(absolute, `Screenshot placeholder for ${event.type} at ${new Date().toISOString()}\n`);
    return relative(active.session_directory, absolute);
  }
}

function sanitizeEvent(event: TraceEvent): TraceEvent {
  if (event.type !== "input") return event;
  const joined = [
    event.selector,
    event.label,
    event.text,
    event.element?.selector,
    event.element?.name,
    event.element?.id,
    event.element?.placeholder,
    event.element?.type
  ]
    .filter(Boolean)
    .join(" ");

  if (/password|passwd|token|secret|api[_-]?key|credit|card|otp|ssn|security\s*code|cvv/i.test(joined)) {
    return { ...event, value_policy: "redacted", value: "[REDACTED]" };
  }

  if (!event.value_policy || event.value_policy === "none") {
    return { ...event, value_policy: "typed_text_placeholder", value: "[TYPED_TEXT]" };
  }

  return event;
}

function shouldCapture(event: TraceEvent): boolean {
  return ["session_started", "navigation", "click", "submit", "session_stopped"].includes(event.type);
}

function elapsedMs(startedAt: string): number {
  return Math.max(0, Date.now() - Date.parse(startedAt));
}

function normalizeTimestamp(ts: number | undefined, startedAt: string): number {
  if (typeof ts !== "number") return elapsedMs(startedAt);
  if (ts > 1_000_000_000_000) return Math.max(0, ts - Date.parse(startedAt));
  return ts;
}

function lastUrl(trace: WorkflowTrace): string {
  return [...trace.events].reverse().find((event) => event.url)?.url ?? trace.target_url;
}
