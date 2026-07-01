import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import type { WorkflowTrace } from "@trailwise/shared";
import type { BackendConfig } from "./config.js";
import type { RecordingSession } from "./store.js";

const execFileAsync = promisify(execFile);
const CODEX_EXEC_TIMEOUT_MS = 240_000;

export interface GenerationResult {
  mode: string;
  promptPath: string;
  artifactPath: string;
  responsePath: string;
}

export interface SkillGenerationResult extends GenerationResult {
  replayPath: string;
}

interface VisualEvidence {
  videoPath?: string;
  framePaths: string[];
  warning?: string;
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
      output = await runCodex(config, prompt, { outputPath: join(generatedDir, "codex-output.txt") });
    } catch (error) {
      mode = "package";
      output = `Codex SDK/CLI generation unavailable; package fallback created. ${describeExecError(error)}`;
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
      output = await runCodex(config, prompt, { outputPath: join(generatedDir, "runbook-codex-output.md") });
    } catch (error) {
      mode = "package";
      output = `Codex SDK/CLI runbook generation unavailable; package fallback created. ${describeExecError(error)}`;
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

export async function generateSkillArtifact(session: RecordingSession, config: BackendConfig): Promise<SkillGenerationResult> {
  const tracePath = session.summary?.trace_path;
  if (!tracePath || !existsSync(tracePath)) {
    throw new Error(`Completed session has no readable trace_path: ${session.session_id}`);
  }

  const trace = JSON.parse(readFileSync(tracePath, "utf8")) as WorkflowTrace;
  const generatedDir = join(dirname(tracePath), "generated", "skill");
  mkdirSync(generatedDir, { recursive: true });

  const visualEvidence = await prepareVisualEvidence(trace, tracePath, generatedDir);
  const prompt = buildSkillPrompt(trace, tracePath, visualEvidence);
  const promptPath = join(generatedDir, "skill-prompt.md");
  const artifactPath = join(generatedDir, "SKILL.md");
  const replayPath = join(generatedDir, "replay.json");
  const responsePath = join(generatedDir, "skill-generation-response.json");
  writeFileSync(promptPath, prompt);

  let mode = config.codexGenerationMode;
  let output = "";

  if (config.codexGenerationMode === "sdk") {
    try {
      output = await runCodex(config, prompt, {
        outputPath: join(generatedDir, "skill-codex-output.md"),
        imagePaths: visualEvidence.framePaths
      });
    } catch (error) {
      mode = "package";
      output = `Codex SDK/CLI skill generation unavailable; package fallback created. ${describeExecError(error)}`;
    }
  } else if (config.codexGenerationMode === "app-server") {
    mode = "package";
    output = "App-server mode is configured but this MVP keeps app-server transport behind package fallback.";
  } else {
    output = "Package mode selected.";
  }

  const skill = extractMarkdown(output) || deterministicSkillFromTrace(trace, tracePath);
  writeFileSync(artifactPath, `${skill.trim()}\n`);
  writeFileSync(
    replayPath,
    `${JSON.stringify(
      {
        schema_version: "0.1",
        generated_at: new Date().toISOString(),
        session_id: trace.session_id,
        trace_path: tracePath,
        video_path: visualEvidence.videoPath,
        visual_frame_paths: visualEvidence.framePaths,
        target_url: trace.target_url,
        action_count: trace.events.filter((event) => event.type === "click" || event.type === "input" || event.type === "submit").length
      },
      null,
      2
    )}\n`
  );
  writeFileSync(
    responsePath,
    `${JSON.stringify(
      {
        mode,
        output_preview: output.slice(0, 4000),
        prompt_path: promptPath,
        artifact_path: artifactPath,
        replay_path: replayPath,
        video_path: visualEvidence.videoPath,
        visual_frame_paths: visualEvidence.framePaths,
        visual_warning: visualEvidence.warning
      },
      null,
      2
    )}\n`
  );

  return { mode, promptPath, artifactPath, responsePath, replayPath };
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

Trace summary:
${summarizeTraceForSkill(trace)}
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

export function buildSkillPrompt(trace: WorkflowTrace, tracePath: string, visualEvidence: VisualEvidence = { framePaths: [] }): string {
  const videoPath = visualEvidence.videoPath ?? "not captured";
  const frameText = visualEvidence.framePaths.length
    ? visualEvidence.framePaths.map((path, index) => `${index + 1}. ${path}`).join("\n")
    : "No frame attachments were extracted. Use the structured trace as the authoritative action log.";
  return `You are Codex analyzing a recorded Chrome workflow.

Create a reusable Codex skill that explains how to replay this workflow safely.
Use the attached sampled video frames as visual evidence when available, and use the structured trace as the authoritative action log.
The skill must cover:
- when to use the workflow
- required variable inputs
- step-by-step behavior
- safety/confirmation boundaries
- how to verify success
- the exact local replay command that controls Chrome through the Trailwise helper

Return only Markdown for a SKILL.md file. Include YAML frontmatter with name and description.

Trace path: ${tracePath}
Recorded video path: ${videoPath}
Sampled frame attachments:
${frameText}

Replay command template:
npm run cli -w @trailwise/dev-helper -- replay-skill --skill <skill-dir> --target-url ${trace.target_url} --expense-id <EXP-ID> --decision <approve|escalate> --browser-channel chrome

Trace summary:
${summarizeTraceForSkill(trace)}
`;
}

async function prepareVisualEvidence(trace: WorkflowTrace, tracePath: string, generatedDir: string): Promise<VisualEvidence> {
  const videoPath = trace.video_path ? join(dirname(tracePath), trace.video_path) : undefined;
  if (!videoPath || !existsSync(videoPath)) return { videoPath, framePaths: [] };

  const frameDir = join(generatedDir, "video-frames");
  rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });

  try {
    await execFileAsync(
      "ffmpeg",
      ["-hide_banner", "-loglevel", "error", "-y", "-i", videoPath, "-vf", "fps=1/5,scale=1280:-1", "-frames:v", "4", join(frameDir, "frame-%03d.png")],
      { timeout: 30_000, maxBuffer: 1024 * 1024 }
    );
  } catch (error) {
    return {
      videoPath,
      framePaths: [],
      warning: `Could not extract video frames with ffmpeg: ${String(error)}`
    };
  }

  const framePaths = readdirSync(frameDir)
    .filter((entry) => /^frame-\d+\.png$/.test(entry))
    .sort()
    .map((entry) => join(frameDir, entry));
  return { videoPath, framePaths };
}

async function runCodex(
  config: BackendConfig,
  prompt: string,
  options: { outputPath: string; imagePaths?: string[] }
): Promise<string> {
  const imageArgs = (options.imagePaths ?? []).flatMap((imagePath) => ["--image", imagePath]);
  const args = [
    "--ask-for-approval",
    "never",
    "exec",
    "--sandbox",
    "read-only",
    "-C",
    config.repoRoot,
    "-o",
    options.outputPath,
    ...imageArgs,
    "--",
    prompt
  ];
  const result = await spawnCodex(config.codexCommand, args, CODEX_EXEC_TIMEOUT_MS);

  if (existsSync(options.outputPath)) {
    const finalMessage = readFileSync(options.outputPath, "utf8").trim();
    if (finalMessage) return finalMessage;
  }

  return result.stdout.trim();
}

async function spawnCodex(command: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = appendBounded(stdout, chunk.toString("utf8"));
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = appendBounded(stderr, chunk.toString("utf8"));
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const commandSummary = [command, ...redactPromptArg(args)].join(" ");
      const error = new Error(`Command failed: ${commandSummary}`);
      Object.assign(error, { code, signal, killed: timedOut, stdout, stderr });
      reject(error);
    });
  });
}

function appendBounded(current: string, addition: string): string {
  const next = current + addition;
  return next.length > 1024 * 1024 * 5 ? next.slice(-(1024 * 1024 * 5)) : next;
}

function redactPromptArg(args: string[]): string[] {
  const separator = args.lastIndexOf("--");
  if (separator < 0 || separator === args.length - 1) return args;
  return [...args.slice(0, separator + 1), "<prompt>"];
}

function summarizeTraceForSkill(trace: WorkflowTrace): string {
  const rows = trace.events
    .filter((event) => ["navigation", "click", "input", "submit"].includes(event.type))
    .map((event) => ({
      seq: event.seq,
      type: event.type,
      ts: event.ts,
      selector: event.selector,
      role: event.role,
      label: event.label,
      text: event.text,
      value_policy: event.value_policy,
      url: event.type === "navigation" ? event.url : undefined
    }));
  return JSON.stringify(
    {
      session_id: trace.session_id,
      target_url: trace.target_url,
      started_at: trace.started_at,
      browser: trace.browser,
      events: rows
    },
    null,
    2
  );
}

function describeExecError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const candidate = error as {
    message?: string;
    code?: unknown;
    signal?: unknown;
    killed?: boolean;
    stdout?: string;
    stderr?: string;
  };
  return JSON.stringify({
    message: candidate.message?.slice(0, 1000),
    code: candidate.code,
    signal: candidate.signal,
    killed: candidate.killed,
    stdout: candidate.stdout?.slice(0, 1000),
    stderr: candidate.stderr?.slice(0, 1000)
  });
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

function deterministicSkillFromTrace(trace: WorkflowTrace, tracePath: string): string {
  const clickEvents = trace.events.filter((event) => event.type === "click");
  const decision = clickEvents.find((event) => /approve|send for review|escalate/i.test(event.text || event.label || ""));
  const rowClick = clickEvents.find((event) => event.selector?.startsWith("[data-id="));
  const videoPath = trace.video_path ? join(dirname(tracePath), trace.video_path) : undefined;

  return [
    "---",
    `name: trailwise-recorded-${trace.session_id}`,
    `description: Replay the recorded Chrome workflow from ${new URL(trace.target_url).hostname}.`,
    "---",
    "",
    "# Trailwise Recorded Workflow",
    "",
    "Use this skill when you need to repeat the recorded browser workflow against the same application screen with new input values.",
    "",
    "## Evidence",
    "",
    `- Trace: ${tracePath}`,
    `- Recorded video: ${videoPath ?? "not captured"}`,
    `- Original target: ${trace.target_url}`,
    `- Recorded action count: ${trace.events.filter((event) => ["click", "input", "submit"].includes(event.type)).length}`,
    "",
    "## Inputs",
    "",
    "- `expense_id`: expense row to select, such as `EXP-4824`.",
    "- `decision`: `approve` or `escalate`.",
    "- `target_url`: page URL to open before replay.",
    "",
    "## Learned Behavior",
    "",
    rowClick ? `1. Select the expense row matching the requested expense id. The demonstration selected ${rowClick.selector}.` : "1. Select the recorded target row or item.",
    decision ? `2. Apply the requested decision using the recorded decision control. The demonstration clicked ${decision.text || decision.label || decision.selector}.` : "2. Apply the recorded action control.",
    "3. Verify that the resolved/status text or row status reflects the requested decision.",
    "",
    "## Replay",
    "",
    "Run:",
    "",
    "```bash",
    `npm run cli -w @trailwise/dev-helper -- replay-skill --skill ${dirname(tracePath)}/generated/skill --target-url ${trace.target_url} --expense-id <EXP-ID> --decision <approve|escalate> --browser-channel chrome`,
    "```",
    "",
    "For automated verification, add `--headless --browser-channel chromium`.",
    "",
    "## Safety",
    "",
    "- Only use this on the allowlisted local demo or an equivalent test environment.",
    "- Do not replay against production finance data without explicit confirmation.",
    "- Re-record the skill if labels, selectors, or page structure change.",
    "",
    "## Success Criteria",
    "",
    "- The target row status changes to `Approved` for `approve`.",
    "- The target row status changes to `Escalated` or resolved text says `Sent to human review` for `escalate`."
  ].join("\n");
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
