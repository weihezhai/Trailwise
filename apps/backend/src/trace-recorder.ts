import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { TraceEvent, WorkflowTrace } from "@trailwise/shared";
import { validateTrace } from "@trailwise/shared";
import type { BackendConfig } from "./config.js";
import type { RecordingSession } from "./store.js";

export function appendRecordedEvent(config: BackendConfig, session: RecordingSession, input: Partial<TraceEvent>): TraceEvent {
  if (!input.url || !sameOrigin(input.url, session.target_url)) {
    throw new Error("event URL does not match the active recording origin");
  }

  const tracePath = join(config.dataDir, "sessions", session.session_id, "trace.json");
  if (!existsSync(tracePath)) {
    throw new Error(`active trace file is missing: ${tracePath}`);
  }

  const trace = JSON.parse(readFileSync(tracePath, "utf8")) as WorkflowTrace;
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

  trace.events.push(event);
  const result = validateTrace(trace);
  if (!result.valid) throw new Error(`Trace validation failed: ${result.errors.join("; ")}`);
  mkdirSync(dirname(tracePath), { recursive: true });
  writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
  return event;
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

function sameOrigin(left: string, right: string): boolean {
  return new URL(left).origin === new URL(right).origin;
}

function elapsedMs(startedAt: string): number {
  return Math.max(0, Date.now() - Date.parse(startedAt));
}

function normalizeTimestamp(ts: number | undefined, startedAt: string): number {
  if (typeof ts !== "number") return elapsedMs(startedAt);
  if (ts > 1_000_000_000_000) return Math.max(0, ts - Date.parse(startedAt));
  return ts;
}
