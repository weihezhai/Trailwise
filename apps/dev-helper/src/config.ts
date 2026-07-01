import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TRAILWISE_EXTENSION_ID = "mgogpbllddkpobdpcgckekigobdklaoh";

export interface DevHelperConfig {
  backendBaseUrl: string;
  helperSecret: string;
  deviceId: string;
  deviceName: string;
  dataDir: string;
  screenshotsEnabled: boolean;
  extensionId: string;
  chromeLoadExtension: boolean;
  chromeUserDataDir: string;
  chromeExtensionDir: string;
  browserCaptureEnabled: boolean;
  browserChannel?: string;
  browserHeadless: boolean;
  browserSlowMo: number;
  browserRemoteDebuggingPort?: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): DevHelperConfig {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const dataDir = resolve(repoRoot, env.TRAILWISE_DATA_DIR || ".trailwise-data");
  mkdirSync(dataDir, { recursive: true });

  return {
    backendBaseUrl: env.BACKEND_BASE_URL || "http://localhost:3100",
    helperSecret: env.HELPER_PAIRING_SECRET || "dev-helper-secret",
    deviceId: env.HELPER_DEVICE_ID || "local-mac",
    deviceName: env.HELPER_DEVICE_NAME || "Local Mac",
    dataDir,
    screenshotsEnabled: env.WORKFLOW_RECORDER_SCREENSHOTS === "1",
    extensionId: env.TRAILWISE_EXTENSION_ID || TRAILWISE_EXTENSION_ID,
    chromeLoadExtension: env.TRAILWISE_CHROME_LOAD_EXTENSION === "1",
    chromeUserDataDir: resolve(repoRoot, env.TRAILWISE_CHROME_USER_DATA_DIR || ".trailwise-chrome-profile"),
    chromeExtensionDir: resolve(repoRoot, env.TRAILWISE_CHROME_EXTENSION_DIR || "apps/chrome-extension"),
    browserCaptureEnabled: env.TRAILWISE_BROWSER_CAPTURE === "1",
    browserChannel: env.TRAILWISE_BROWSER_CHANNEL || "chrome",
    browserHeadless: env.TRAILWISE_BROWSER_HEADLESS === "1",
    browserSlowMo: Number(env.TRAILWISE_BROWSER_SLOW_MO || 100),
    browserRemoteDebuggingPort: optionalNumber(env.TRAILWISE_BROWSER_REMOTE_DEBUGGING_PORT)
  };
}

export function defaultManifestPath(): string {
  return resolve(homedir(), "Library/Application Support/Google/Chrome/NativeMessagingHosts/com.trailwise.workflow_recorder.json");
}

function optionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
