import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { WorkflowTrace } from "@trailwise/shared";
import type { BackendConfig } from "./config.js";
import { generateSkillArtifact } from "./generation.js";
import type { RecordingSession } from "./store.js";

test("generateSkillArtifact writes SKILL.md and replay metadata", async () => {
  const dir = mkdtempSync(join(tmpdir(), "trailwise-skill-"));
  try {
    const sessionDir = join(dir, "sessions", "sess_test");
    const tracePath = join(sessionDir, "trace.json");
    mkdirSync(join(sessionDir, "video"), { recursive: true });
    const trace: WorkflowTrace = {
      schema_version: "0.1",
      session_id: "sess_test",
      platform: "macos",
      browser: "chrome",
      started_at: "2026-07-01T00:00:00.000Z",
      target_url: "http://localhost:5173/expense-flow.html",
      video_path: "video/demo.webm",
      events: [
        { seq: 1, type: "session_started", ts: 0, value_policy: "none" },
        { seq: 2, type: "click", ts: 10, selector: "[data-id=\"EXP-4821\"]", text: "Sarah Chen" },
        { seq: 3, type: "click", ts: 20, selector: "button", role: "button", text: "Approve" }
      ]
    };
    writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`, { flag: "wx" });

    const session: RecordingSession = {
      session_id: "sess_test",
      slack_team_id: "T",
      slack_channel_id: "C",
      slack_user_id: "U",
      target_url: trace.target_url,
      status: "completed",
      created_at: "2026-07-01T00:00:00.000Z",
      summary: {
        session_id: "sess_test",
        duration_ms: 100,
        events_count: 2,
        screenshots_count: 0,
        redactions_count: 0,
        trace_path: tracePath,
        video_path: trace.video_path
      }
    };

    const config: BackendConfig = {
      port: 3100,
      backendBaseUrl: "http://localhost:3100",
      helperPairingSecret: "secret",
      allowedRecordingOrigins: ["http://localhost:5173"],
      dataDir: dir,
      repoRoot: dir,
      codexGenerationMode: "package",
      codexCommand: "codex"
    };

    const result = await generateSkillArtifact(session, config);
    assert.equal(existsSync(result.artifactPath), true);
    assert.equal(existsSync(result.replayPath), true);

    const skill = readFileSync(result.artifactPath, "utf8");
    assert.match(skill, /Trailwise Recorded Workflow/);
    const replay = JSON.parse(readFileSync(result.replayPath, "utf8")) as { trace_path?: string; video_path?: string };
    assert.equal(replay.trace_path, tracePath);
    assert.equal(replay.video_path, join(sessionDir, "video/demo.webm"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
