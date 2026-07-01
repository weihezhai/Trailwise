import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type CodexGenerationMode = "sdk" | "package" | "app-server";

export interface BackendConfig {
  port: number;
  backendBaseUrl: string;
  slackBotToken?: string;
  slackSigningSecret?: string;
  slackTestChannelId?: string;
  helperPairingSecret: string;
  allowedRecordingOrigins: string[];
  dataDir: string;
  repoRoot: string;
  codexGenerationMode: CodexGenerationMode;
  codexAppServerUrl?: string;
  codexCommand: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  const repoRoot = findRepoRoot(env.INIT_CWD || process.cwd());
  const mergedEnv = {
    ...readEnvFile(resolve(repoRoot, ".env")),
    ...readEnvFile(resolve(repoRoot, ".env.local")),
    ...env
  };
  const dataDir = resolve(repoRoot, env.TRAILWISE_DATA_DIR || ".trailwise-data");
  mkdirSync(dataDir, { recursive: true });

  return {
    port: Number(mergedEnv.BACKEND_PORT || 3100),
    backendBaseUrl: mergedEnv.BACKEND_BASE_URL || "http://localhost:3100",
    slackBotToken: mergedEnv.SLACK_BOT_TOKEN || undefined,
    slackSigningSecret: mergedEnv.SLACK_SIGNING_SECRET || undefined,
    slackTestChannelId: mergedEnv.SLACK_TEST_CHANNEL_ID || undefined,
    helperPairingSecret: mergedEnv.HELPER_PAIRING_SECRET || "dev-helper-secret",
    allowedRecordingOrigins: parseList(mergedEnv.ALLOWED_RECORDING_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173"),
    dataDir,
    repoRoot,
    codexGenerationMode: parseGenerationMode(mergedEnv.CODEX_GENERATION_MODE),
    codexAppServerUrl: mergedEnv.CODEX_APP_SERVER_URL || undefined,
    codexCommand: mergedEnv.CODEX_COMMAND || "codex"
  };
}

function findRepoRoot(start: string): string {
  let current = resolve(start);
  while (true) {
    const packagePath = resolve(current, "package.json");
    if (existsSync(packagePath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { workspaces?: unknown };
        if (Array.isArray(packageJson.workspaces)) return current;
      } catch {
        // Keep walking.
      }
    }

    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseGenerationMode(value: string | undefined): CodexGenerationMode {
  if (value === "package" || value === "app-server" || value === "sdk") return value;
  return "sdk";
}

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const output: Record<string, string> = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    output[key] = value;
  }
  return output;
}
