import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

export interface DevHelperConfig {
  backendBaseUrl: string;
  helperSecret: string;
  deviceId: string;
  deviceName: string;
  dataDir: string;
  screenshotsEnabled: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): DevHelperConfig {
  const dataDir = resolve(
    env.INIT_CWD || process.cwd(),
    env.TRAILWISE_DATA_DIR || ".trailwise-data"
  );
  mkdirSync(dataDir, { recursive: true });

  return {
    backendBaseUrl: env.BACKEND_BASE_URL || "http://localhost:3000",
    helperSecret: env.HELPER_PAIRING_SECRET || "dev-helper-secret",
    deviceId: env.HELPER_DEVICE_ID || "local-mac",
    deviceName: env.HELPER_DEVICE_NAME || "Local Mac",
    dataDir,
    screenshotsEnabled: env.WORKFLOW_RECORDER_SCREENSHOTS === "1"
  };
}

export function defaultManifestPath(): string {
  return resolve(homedir(), "Library/Application Support/Google/Chrome/NativeMessagingHosts/com.trailwise.workflow_recorder.json");
}
