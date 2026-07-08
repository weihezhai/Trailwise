import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { BackendConfig } from "./config.js";
import { createServer } from "./server.js";

test("returns a session action log by session id", async () => {
  const dir = mkdtempSync(join(tmpdir(), "trailwise-server-"));
  try {
    const config: BackendConfig = {
      port: 0,
      backendBaseUrl: "http://localhost:0",
      helperPairingSecret: "secret",
      allowedRecordingOrigins: ["http://localhost:5173"],
      dataDir: dir,
      repoRoot: dir,
      codexGenerationMode: "sdk",
      codexCommand: "codex"
    };
    const { app, store } = createServer(config);
    const server = app.listen(0);
    await once(server, "listening");

    try {
      const startedAt = new Date("2026-01-01T10:00:00.000Z").toISOString();
      const session = store.createSession({
        slack_team_id: "T",
        slack_channel_id: "C",
        slack_user_id: "U",
        target_url: "http://localhost:5173/expense-flow.html"
      });
      store.updateSession(session.session_id, { status: "completed", started_at: startedAt });

      const sessionDir = join(dir, "sessions", session.session_id);
      mkdirSync(sessionDir, { recursive: true });
      writeFileSync(
        join(sessionDir, "trace.json"),
        `${JSON.stringify(
          {
            schema_version: "0.1",
            session_id: session.session_id,
            platform: "macos",
            browser: "chrome",
            started_at: startedAt,
            target_url: session.target_url,
            events: [
              { seq: 1, type: "session_started", ts: 0, url: session.target_url, value_policy: "none" },
              {
                seq: 2,
                type: "click",
                ts: 500,
                url: session.target_url,
                selector: "button[type=submit]",
                label: "Submit Expense",
                value_policy: "none"
              },
              {
                seq: 3,
                type: "input",
                ts: 750,
                url: session.target_url,
                selector: "input[name=amount]",
                label: "Amount",
                value: "[TYPED_TEXT]",
                value_policy: "typed_text_placeholder"
              }
            ]
          },
          null,
          2
        )}\n`
      );

      const address = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${address.port}/sessions/${session.session_id}/log`);
      assert.equal(response.ok, true);
      const body = (await response.json()) as { session_id?: string; events?: Array<{ type?: string; label?: string }> };

      assert.equal(body.session_id, session.session_id);
      assert.equal(body.events?.length, 3);
      assert.equal(body.events?.[1]?.type, "click");
      assert.equal(body.events?.[1]?.label, "Submit Expense");
    } finally {
      server.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
