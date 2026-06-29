#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { BackendClient } from "./backend-client.js";
import { defaultManifestPath, loadConfig } from "./config.js";
import { TraceStore } from "./trace-store.js";

const config = loadConfig();
const client = new BackendClient(config);
const store = new TraceStore(config);
const [command = "help", ...args] = process.argv.slice(2);

if (command === "pair") {
  console.log(JSON.stringify(await client.pair(), null, 2));
} else if (command === "pending") {
  console.log(JSON.stringify(await client.pendingSessions(), null, 2));
} else if (command === "accept-next") {
  await client.pair();
  const session = (await client.pendingSessions()).find((candidate) => candidate.status === "pending_local_confirmation");
  if (!session) throw new Error("No pending session to accept");
  store.start(session);
  await client.confirm(session.session_id);
  openChrome(session.target_url);
  console.log(`Accepted ${session.session_id}`);
} else if (command === "append-event") {
  const event = JSON.parse(args.join(" ") || "{}") as Record<string, unknown>;
  console.log(JSON.stringify(store.append(event), null, 2));
} else if (command === "stop-active") {
  const active = store.activeSession();
  if (!active) throw new Error("No active session");
  const summary = store.finalize(false);
  await client.summary(active.session_id, summary);
  console.log(JSON.stringify(summary, null, 2));
} else if (command === "install-native-host") {
  const extensionId = option(args, "--extension-id");
  if (!extensionId) throw new Error("Usage: trailwise-dev-helper install-native-host --extension-id <id>");
  installNativeHost(extensionId);
} else if (command === "run") {
  await runLoop(args.includes("--auto-start"));
} else {
  console.log(`Usage:
  trailwise-dev-helper pair
  trailwise-dev-helper pending
  trailwise-dev-helper accept-next
  trailwise-dev-helper append-event '<json>'
  trailwise-dev-helper stop-active
  trailwise-dev-helper install-native-host --extension-id <id>
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
        const summary = store.finalize(false);
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
          store.start(session);
          await client.confirm(session.session_id);
          openChrome(session.target_url);
          console.log(`Auto-started ${session.session_id}`);
        } else if (session.status === "pending_local_confirmation") {
          console.log(`Pending local confirmation: ${session.session_id} ${session.target_url}`);
        }
      }
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000));
  }
}

function installNativeHost(extensionId: string): void {
  const distNativeHost = resolve(dirname(fileURLToPath(import.meta.url)), "native-host.js");
  const manifest = {
    name: "com.trailwise.workflow_recorder",
    description: "Trailwise Workflow Recorder Native Host",
    path: distNativeHost,
    type: "stdio",
    allowed_origins: [`chrome-extension://${extensionId}/`]
  };
  const destination = defaultManifestPath();
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Installed Native Messaging manifest at ${destination}`);
  console.log(`Native host path: ${distNativeHost}`);
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function openChrome(url: string): void {
  const child = spawn("/usr/bin/open", ["-a", "Google Chrome", url], { stdio: "ignore", detached: true });
  child.unref();
}
