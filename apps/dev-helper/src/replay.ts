import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium, type Page } from "playwright";
import type { TraceEvent, WorkflowTrace } from "@trailwise/shared";

export interface ReplayOptions {
  dataDir: string;
  tracePath?: string;
  targetUrl?: string;
  expenseId?: string;
  decision?: "approve" | "escalate";
  headless?: boolean;
  channel?: string;
  slowMo?: number;
}

export interface ReplaySkillOptions extends Omit<ReplayOptions, "tracePath"> {
  skillPath: string;
}

export interface ReplayResult {
  trace_path: string;
  target_url: string;
  events_replayed: number;
  final_state: unknown;
}

export async function replayTrace(options: ReplayOptions): Promise<ReplayResult> {
  const tracePath = options.tracePath || findLatestTracePath(options.dataDir);
  const trace = JSON.parse(readFileSync(tracePath, "utf8")) as WorkflowTrace;
  const targetUrl = options.targetUrl || trace.target_url;
  const browser = await chromium.launch({
    channel: options.channel,
    headless: options.headless ?? false,
    slowMo: options.slowMo
  });

  try {
    const page = await browser.newPage();
    await page.goto(targetUrl);
    let eventsReplayed = 0;

    for (const event of trace.events) {
      if (event.type === "click") {
        await replayClick(page, event, options);
        eventsReplayed += 1;
      }

      if (event.type === "input") {
        await replayInput(page, event);
        eventsReplayed += 1;
      }
    }

    await page.waitForTimeout(500);
    return {
      trace_path: tracePath,
      target_url: targetUrl,
      events_replayed: eventsReplayed,
      final_state: await readPageState(page)
    };
  } finally {
    await browser.close();
  }
}

export async function replaySkill(options: ReplaySkillOptions): Promise<ReplayResult> {
  const skillDir = options.skillPath.endsWith(".md") ? dirname(options.skillPath) : options.skillPath;
  const replayPath = join(skillDir, "replay.json");
  if (!existsSync(replayPath)) throw new Error(`Skill replay metadata is missing: ${replayPath}`);

  const replay = JSON.parse(readFileSync(replayPath, "utf8")) as {
    trace_path?: string;
    target_url?: string;
  };
  if (!replay.trace_path) throw new Error(`Skill replay metadata has no trace_path: ${replayPath}`);

  return replayTrace({
    ...options,
    tracePath: replay.trace_path,
    targetUrl: options.targetUrl || replay.target_url
  });
}

export function findLatestTracePath(dataDir: string): string {
  const sessionsDir = join(dataDir, "sessions");
  if (!existsSync(sessionsDir)) throw new Error(`No sessions directory found: ${sessionsDir}`);

  const candidates = readdirSync(sessionsDir)
    .map((entry) => join(sessionsDir, entry, "trace.json"))
    .filter((path) => existsSync(path))
    .map((path) => ({ path, mtimeMs: statSync(path).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (!candidates.length) throw new Error(`No trace.json files found under ${sessionsDir}`);
  return candidates[0].path;
}

async function replayClick(page: Page, event: TraceEvent, options: ReplayOptions): Promise<void> {
  const decisionText = decisionButtonText(event, options.decision);
  if (decisionText) {
    await page.getByRole("button", { name: decisionText }).click({ timeout: 5000 });
    return;
  }

  const selector = overrideExpenseSelector(event.selector, options.expenseId);
  if (selector) {
    await page.locator(selector).first().click({ timeout: 5000 });
    return;
  }

  if (event.role && event.text) {
    await page.getByRole(event.role as never, { name: normalizeText(event.text) }).click({ timeout: 5000 });
    return;
  }

  if (event.text) {
    await page.getByText(normalizeText(event.text)).first().click({ timeout: 5000 });
    return;
  }

  throw new Error(`Cannot replay click event ${event.seq}: no selector, role, or text`);
}

async function replayInput(page: Page, event: TraceEvent): Promise<void> {
  if (!event.selector) throw new Error(`Cannot replay input event ${event.seq}: no selector`);
  const envName = `TRAILWISE_REPLAY_${String(event.label || event.selector)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")}`;
  const value =
    event.value_policy === "redacted" || event.value_policy === "typed_text_placeholder"
      ? process.env[envName] || "test-value"
      : event.value || "";
  await page.locator(event.selector).first().fill(value, { timeout: 5000 });
}

function overrideExpenseSelector(selector: string | undefined, expenseId: string | undefined): string | undefined {
  if (!selector) return undefined;
  if (!expenseId || !selector.startsWith("[data-id=")) return selector;
  return `[data-id="${cssEscape(expenseId)}"]`;
}

function decisionButtonText(event: TraceEvent, decision: ReplayOptions["decision"]): string | undefined {
  const text = normalizeText(event.text || event.label || "");
  const isDecisionClick = /^(Approve|Send for review|Escalate)$/i.test(text);
  if (!isDecisionClick) return undefined;
  if (decision === "escalate") return "Send for review";
  if (decision === "approve") return "Approve";
  return text;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

async function readPageState(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("[data-id]")).map((row) => ({
      id: (row as HTMLElement).dataset.id,
      text: row.textContent?.replace(/\s+/g, " ").trim()
    }));
    return {
      title: document.title,
      url: location.href,
      pending_count: document.querySelector("#qCount")?.textContent?.trim(),
      resolved_text: document.querySelector(".resolved")?.textContent?.replace(/\s+/g, " ").trim(),
      toasts: Array.from(document.querySelectorAll(".toast")).map((toast) => toast.textContent?.replace(/\s+/g, " ").trim()),
      rows
    };
  });
}
