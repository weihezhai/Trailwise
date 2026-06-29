import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { WorkflowTrace } from "@trailwise/shared";
import type { BackendConfig } from "./config.js";
import type { RecordingSession } from "./store.js";

const execFileAsync = promisify(execFile);

export interface GenerationResult {
  mode: string;
  promptPath: string;
  artifactPath: string;
  responsePath: string;
}

export async function generatePlaywrightArtifact(session: RecordingSession, config: BackendConfig): Promise<GenerationResult> {
  const tracePath = session.summary?.trace_path;
  if (!tracePath || !existsSync(tracePath)) {
    throw new Error(`Completed session has no readable trace_path: ${session.session_id}`);
  }

  const trace = JSON.parse(readFileSync(tracePath, "utf8")) as WorkflowTrace;
  const generatedDir = join(dirname(tracePath), "generated");
  mkdirSync(generatedDir, { recursive: true });

  const prompt = buildCodexPrompt(trace);
  const promptPath = join(generatedDir, "codex-prompt.md");
  const artifactPath = join(generatedDir, "playwright.spec.ts");
  const responsePath = join(generatedDir, "generation-response.json");

  writeFileSync(promptPath, prompt);

  let mode = config.codexGenerationMode;
  let output = "";

  if (config.codexGenerationMode === "sdk") {
    try {
      const result = await execFileAsync(
        config.codexCommand,
        ["exec", "--sandbox", "read-only", "--ask-for-approval", "never", "-C", config.repoRoot, prompt],
        { timeout: 120_000, maxBuffer: 1024 * 1024 * 5 }
      );
      output = result.stdout.trim();
    } catch (error) {
      mode = "package";
      output = `Codex SDK/CLI generation unavailable; package fallback created. ${String(error)}`;
    }
  } else if (config.codexGenerationMode === "app-server") {
    mode = "package";
    output = "App-server mode is configured but this MVP keeps app-server transport behind package fallback.";
  } else {
    output = "Package mode selected.";
  }

  const artifact = extractTypeScript(output) || deterministicPlaywrightFromTrace(trace);
  writeFileSync(artifactPath, `${artifact.trim()}\n`);
  writeFileSync(
    responsePath,
    `${JSON.stringify(
      {
        mode,
        output_preview: output.slice(0, 4000),
        prompt_path: promptPath,
        artifact_path: artifactPath
      },
      null,
      2
    )}\n`
  );

  return { mode, promptPath, artifactPath, responsePath };
}

export async function generateRunbookArtifact(session: RecordingSession, config: BackendConfig): Promise<GenerationResult> {
  const tracePath = session.summary?.trace_path;
  if (!tracePath || !existsSync(tracePath)) {
    throw new Error(`Completed session has no readable trace_path: ${session.session_id}`);
  }

  const trace = JSON.parse(readFileSync(tracePath, "utf8")) as WorkflowTrace;
  const generatedDir = join(dirname(tracePath), "generated");
  mkdirSync(generatedDir, { recursive: true });

  const prompt = buildRunbookPrompt(trace);
  const promptPath = join(generatedDir, "runbook-prompt.md");
  const artifactPath = join(generatedDir, "runbook.md");
  const responsePath = join(generatedDir, "runbook-generation-response.json");
  writeFileSync(promptPath, prompt);

  let mode = config.codexGenerationMode;
  let output = "";

  if (config.codexGenerationMode === "sdk") {
    try {
      const result = await execFileAsync(
        config.codexCommand,
        ["exec", "--sandbox", "read-only", "--ask-for-approval", "never", "-C", config.repoRoot, prompt],
        { timeout: 120_000, maxBuffer: 1024 * 1024 * 5 }
      );
      output = result.stdout.trim();
    } catch (error) {
      mode = "package";
      output = `Codex SDK/CLI runbook generation unavailable; package fallback created. ${String(error)}`;
    }
  } else if (config.codexGenerationMode === "app-server") {
    mode = "package";
    output = "App-server mode is configured but this MVP keeps app-server transport behind package fallback.";
  } else {
    output = "Package mode selected.";
  }

  const artifact = extractMarkdown(output) || deterministicRunbookFromTrace(trace);
  writeFileSync(artifactPath, `${artifact.trim()}\n`);
  writeFileSync(
    responsePath,
    `${JSON.stringify(
      {
        mode,
        output_preview: output.slice(0, 4000),
        prompt_path: promptPath,
        artifact_path: artifactPath
      },
      null,
      2
    )}\n`
  );

  return { mode, promptPath, artifactPath, responsePath };
}

export function buildCodexPrompt(trace: WorkflowTrace): string {
  return `You are given a recorded Chrome workflow.

Generate a Playwright test that reproduces the workflow.
Prefer stable selectors in this order: data-testid, aria-label, role/name, visible text, name.
Do not include secrets or redacted input values.
Use environment variables for redacted or synthetic credentials.
Ask for missing test data instead of inventing credentials.
Return only the TypeScript Playwright test code in one fenced ts block.

Target output path:
tests/${slugFromUrl(trace.target_url)}.recorded.spec.ts

Trace:
${JSON.stringify(trace, null, 2)}
`;
}

export function buildRunbookPrompt(trace: WorkflowTrace): string {
  return `You are given a recorded Chrome workflow.

Generate a concise Markdown runbook for a human QA/product user.
Do not include secrets or redacted input values.
Mention environment variables or test data placeholders where inputs were redacted.
Return only Markdown.

Trace:
${JSON.stringify(trace, null, 2)}
`;
}

function deterministicPlaywrightFromTrace(trace: WorkflowTrace): string {
  const lines = [
    `import { test, expect } from "@playwright/test";`,
    "",
    `test("recorded ${slugFromUrl(trace.target_url)} workflow", async ({ page }) => {`,
    `  await page.goto(${JSON.stringify(trace.target_url)});`
  ];

  for (const event of trace.events) {
    if (event.type === "click" && event.selector) {
      if (event.role && event.text) {
        lines.push(`  await page.getByRole(${JSON.stringify(event.role as never)}, { name: ${JSON.stringify(event.text)} }).click();`);
      } else {
        lines.push(`  await page.locator(${JSON.stringify(event.selector)}).click();`);
      }
    }

    if (event.type === "input" && event.selector) {
      const value = event.value_policy === "redacted" ? envNameFor(event.label || event.selector) : "TEST_VALUE";
      lines.push(`  await page.locator(${JSON.stringify(event.selector)}).fill(process.env.${value} ?? "test-value");`);
    }
  }

  const lastUrl = [...trace.events].reverse().find((event) => event.url)?.url;
  if (lastUrl && lastUrl !== trace.target_url) {
    lines.push(`  await expect(page).toHaveURL(${JSON.stringify(lastUrl)});`);
  }
  lines.push("});");
  return lines.join("\n");
}

function extractTypeScript(output: string): string | undefined {
  const match = output.match(/```(?:ts|typescript)\n([\s\S]*?)```/i);
  return match?.[1]?.trim();
}

function extractMarkdown(output: string): string | undefined {
  const fenced = output.match(/```(?:md|markdown)\n([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) return fenced[1].trim();
  const trimmed = output.trim();
  if (trimmed.startsWith("#") || trimmed.startsWith("##")) return trimmed;
  return undefined;
}

function deterministicRunbookFromTrace(trace: WorkflowTrace): string {
  const lines = [
    `# Recorded Workflow Runbook`,
    "",
    `Target: ${trace.target_url}`,
    "",
    "## Summary",
    "",
    `- Session: ${trace.session_id}`,
    `- Browser: ${trace.browser}`,
    `- Started: ${trace.started_at}`,
    `- Events: ${trace.events.length}`,
    "",
    "## Steps",
    ""
  ];

  let step = 1;
  for (const event of trace.events) {
    if (event.type === "navigation" && event.url) {
      lines.push(`${step}. Navigate to ${event.url}.`);
      step += 1;
    }
    if (event.type === "click") {
      lines.push(`${step}. Click ${humanTarget(event)}.`);
      step += 1;
    }
    if (event.type === "input") {
      const value = event.value_policy === "redacted" ? "a redacted test value from environment/configuration" : "test input text";
      lines.push(`${step}. Fill ${humanTarget(event)} with ${value}.`);
      step += 1;
    }
    if (event.type === "submit") {
      lines.push(`${step}. Submit ${humanTarget(event)}.`);
      step += 1;
    }
  }

  const finalUrl = [...trace.events].reverse().find((event) => event.url)?.url;
  if (finalUrl && finalUrl !== trace.target_url) {
    lines.push("", "## Expected Result", "", `The workflow ends at ${finalUrl}.`);
  }

  return lines.join("\n");
}

function humanTarget(event: { label?: string; text?: string; selector?: string }): string {
  return event.label || event.text || event.selector || "the recorded element";
}

function slugFromUrl(targetUrl: string): string {
  const url = new URL(targetUrl);
  const pieces = [url.hostname.replace(/\W+/g, "-"), url.pathname.replace(/\W+/g, "-")]
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return pieces || "workflow";
}

function envNameFor(field: string): string {
  return `TEST_${field.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}
