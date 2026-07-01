#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { BackendClient } from "./backend-client.js";
import { BrowserCaptureController } from "./browser-capture.js";
import { defaultManifestPath, loadConfig } from "./config.js";
import { replaySkill, replayTrace } from "./replay.js";
import { TraceStore } from "./trace-store.js";

const config = loadConfig();
const client = new BackendClient(config);
const store = new TraceStore(config);
const browserCapture = new BrowserCaptureController(config, store);
const [command = "help", ...args] = process.argv.slice(2);

if (command === "pair") {
  console.log(JSON.stringify(await client.pair(), null, 2));
} else if (command === "pending") {
  console.log(JSON.stringify(await client.pendingSessions(), null, 2));
} else if (command === "accept-next") {
  await client.pair();
  const session = (await client.pendingSessions()).find((candidate) => candidate.status === "pending_local_confirmation");
  if (!session) throw new Error("No pending session to accept");
  if (config.browserCaptureEnabled) {
    await browserCapture.start(session);
  } else {
    store.start(session);
  }
  await client.confirm(session.session_id);
  if (!config.browserCaptureEnabled) openChrome(session.target_url);
  console.log(`Accepted ${session.session_id}`);
} else if (command === "capture-next") {
  await captureNext();
} else if (command === "append-event") {
  const event = JSON.parse(args.join(" ") || "{}") as Record<string, unknown>;
  console.log(JSON.stringify(store.append(event), null, 2));
} else if (command === "stop-active") {
  const active = store.activeSession();
  if (!active) throw new Error("No active session");
  const videoPath = await browserCapture.stop();
  const summary = store.finalize(false, { videoPath });
  await client.summary(active.session_id, summary);
  console.log(JSON.stringify(summary, null, 2));
} else if (command === "install-native-host") {
  const extensionId = option(args, "--extension-id") || config.extensionId;
  installNativeHost(extensionId);
} else if (command === "replay" || command === "replay-latest") {
  const result = await replayTrace({
    dataDir: config.dataDir,
    tracePath: command === "replay" ? option(args, "--trace") : undefined,
    targetUrl: option(args, "--target-url"),
    expenseId: option(args, "--expense-id"),
    decision: parseDecision(option(args, "--decision")),
    headless: args.includes("--headless"),
    channel: option(args, "--browser-channel") || "chrome",
    slowMo: Number(option(args, "--slow-mo") || (args.includes("--headless") ? 0 : 150))
  });
  console.log(JSON.stringify(result, null, 2));
} else if (command === "replay-skill") {
  const skill = option(args, "--skill");
  if (!skill) throw new Error("Usage: trailwise-dev-helper replay-skill --skill <skill-dir-or-SKILL.md>");
  const result = await replaySkill({
    skillPath: skill,
    dataDir: config.dataDir,
    targetUrl: option(args, "--target-url"),
    expenseId: option(args, "--expense-id"),
    decision: parseDecision(option(args, "--decision")),
    headless: args.includes("--headless"),
    channel: option(args, "--browser-channel") || "chrome",
    slowMo: Number(option(args, "--slow-mo") || (args.includes("--headless") ? 0 : 150))
  });
  console.log(JSON.stringify(result, null, 2));
} else if (command === "run") {
  await runLoop(args.includes("--auto-start"));
} else {
  console.log(`Usage:
  trailwise-dev-helper pair
  trailwise-dev-helper pending
  trailwise-dev-helper accept-next
  trailwise-dev-helper capture-next
  trailwise-dev-helper append-event '<json>'
  trailwise-dev-helper stop-active
  trailwise-dev-helper install-native-host [--extension-id <id>]
  trailwise-dev-helper replay --trace <trace.json> [--expense-id EXP-4821] [--decision approve|escalate] [--headless]
  trailwise-dev-helper replay-latest [--expense-id EXP-4821] [--decision approve|escalate] [--headless]
  trailwise-dev-helper replay-skill --skill <skill-dir-or-SKILL.md> [--expense-id EXP-4821] [--decision approve|escalate] [--headless]
  trailwise-dev-helper run [--auto-start]`);
}

async function runLoop(autoStart: boolean): Promise<void> {
  await client.pair();
  console.log(`Trailwise dev helper paired as ${config.deviceName} (${config.deviceId})`);
  while (true) {
    const active = store.activeSession();
    if (active) {
      const session = await client.session(active.session_id);
      if (session.status === "stopping") {
        const videoPath = await browserCapture.stop();
        const summary = store.finalize(false, { videoPath });
        await client.summary(active.session_id, summary);
        console.log(`Finalized ${active.session_id}`);
      } else if (session.status === "deleted") {
        store.delete(active.session_id);
        console.log(`Deleted ${active.session_id}`);
      }
    } else {
      for (const session of await client.pendingSessions()) {
        if (session.status === "deleted") {
          store.delete(session.session_id);
          continue;
        }

        if (session.status === "pending_local_confirmation" && autoStart) {
          if (config.browserCaptureEnabled) {
            await browserCapture.start(session);
          } else {
            store.start(session);
          }
          await client.confirm(session.session_id);
          if (!config.browserCaptureEnabled) openChrome(session.target_url);
          console.log(`Auto-started ${session.session_id}`);
        } else if (session.status === "pending_local_confirmation") {
          console.log(`Pending local confirmation: ${session.session_id} ${session.target_url}`);
        }
      }
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000));
  }
}

async function captureNext(): Promise<void> {
  await client.pair();
  const session = (await client.pendingSessions()).find((candidate) => candidate.status === "pending_local_confirmation");
  if (!session) throw new Error("No pending session to capture");
  await browserCapture.start(session);
  await client.confirm(session.session_id);
  console.log(`Capturing ${session.session_id}. Stop it from the backend/Slack command to finalize video and trace.`);

  while (true) {
    const latest = await client.session(session.session_id);
    if (latest.status === "stopping") {
      const videoPath = await browserCapture.stop();
      const summary = store.finalize(false, { videoPath });
      await client.summary(session.session_id, summary);
      console.log(JSON.stringify(summary, null, 2));
      return;
    }
    if (latest.status === "deleted" || latest.status === "cancelled") {
      const videoPath = await browserCapture.stop();
      const summary = store.finalize(true, { videoPath });
      await client.summary(session.session_id, summary);
      console.log(JSON.stringify(summary, null, 2));
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
  }
}

function installNativeHost(extensionId: string): void {
  const cliDir = dirname(fileURLToPath(import.meta.url));
  const distNativeHost = cliDir.endsWith("/src") ? resolve(cliDir, "../dist/native-host.js") : resolve(cliDir, "native-host.js");
  if (!existsSync(distNativeHost)) {
    throw new Error(`Native host build output is missing: ${distNativeHost}. Run npm run build -w @trailwise/dev-helper first.`);
  }
  const repoRoot = resolve(cliDir, cliDir.endsWith("/src") ? "../../.." : "../../../");
  const wrapperPath = resolve(config.dataDir, "native-host-wrapper.sh");
  writeFileSync(
    wrapperPath,
    [
      "#!/bin/sh",
      `cd ${shellQuote(repoRoot)} || exit 1`,
      `export TRAILWISE_DATA_DIR=${shellQuote(config.dataDir)}`,
      `export BACKEND_BASE_URL=${shellQuote(config.backendBaseUrl)}`,
      `export HELPER_PAIRING_SECRET=${shellQuote(config.helperSecret)}`,
      `exec node --import tsx ${shellQuote(resolve(repoRoot, "apps/dev-helper/src/native-host.ts"))}`
    ].join("\n") + "\n"
  );
  chmodSync(wrapperPath, 0o755);

  const manifest = {
    name: "com.trailwise.workflow_recorder",
    description: "Trailwise Workflow Recorder Native Host",
    path: wrapperPath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${extensionId}/`]
  };
  const destination = defaultManifestPath();
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Installed Native Messaging manifest at ${destination}`);
  console.log(`Native host wrapper: ${wrapperPath}`);
  console.log(`Native host build output: ${distNativeHost}`);
  console.log(`Allowed Chrome extension: ${extensionId}`);
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function openChrome(url: string): void {
  const args = config.chromeLoadExtension
    ? [
        "-na",
        "Google Chrome",
        "--args",
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${config.chromeUserDataDir}`,
        `--disable-extensions-except=${config.chromeExtensionDir}`,
        `--load-extension=${config.chromeExtensionDir}`,
        url
      ]
    : ["-a", "Google Chrome", url];
  const child = spawn("/usr/bin/open", args, { stdio: "ignore", detached: true });
  child.unref();
}

function parseDecision(value: string | undefined): "approve" | "escalate" | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === "approve" || normalized === "approved") return "approve";
  if (normalized === "escalate" || normalized === "escalated" || normalized === "review") return "escalate";
  throw new Error("--decision must be approve or escalate");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
