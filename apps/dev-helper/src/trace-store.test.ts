import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { DevHelperConfig } from "./config.js";
import { TraceStore } from "./trace-store.js";

function config(dataDir: string): DevHelperConfig {
  return {
    backendBaseUrl: "http://localhost:3000",
    helperSecret: "secret",
    deviceId: "device",
    deviceName: "Device",
    dataDir,
    screenshotsEnabled: false,
    extensionId: "extension",
    chromeLoadExtension: false,
    chromeUserDataDir: join(dataDir, "chrome"),
    chromeExtensionDir: join(dataDir, "extension"),
    browserCaptureEnabled: false,
    browserChannel: "chromium",
    browserHeadless: true,
    browserSlowMo: 0,
    browserRemoteDebuggingPort: undefined
  };
}

test("starts, appends redacted event, and finalizes a trace", () => {
  const dir = mkdtempSync(join(tmpdir(), "trailwise-dev-helper-"));
  try {
    const store = new TraceStore(config(dir));
    const active = store.start({ session_id: "sess_test", target_url: "http://localhost:5173", status: "pending_local_confirmation" });
    assert.equal(active.session_id, "sess_test");

    const event = store.append({
      type: "input",
      ts: 10,
      url: "http://localhost:5173",
      selector: "input[name=\"password\"]",
      value: "secret"
    });
    assert.equal(event?.value_policy, "redacted");
    assert.equal(event?.value, "[REDACTED]");

    const summary = store.finalize();
    assert.equal(summary.session_id, "sess_test");
    assert.equal(summary.events_count, 1);
    assert.equal(summary.redactions_count, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
