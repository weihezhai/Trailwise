import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadConfig } from "./config.js";

test("loads local .env values without committing secrets", () => {
  const dir = mkdtempSync(join(tmpdir(), "trailwise-config-"));
  try {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        private: true,
        workspaces: ["apps/backend"]
      })
    );
    writeFileSync(join(dir, ".env"), "SLACK_BOT_TOKEN=xoxb-test\nSLACK_TEST_CHANNEL_ID=C123\nBACKEND_PORT=3999\n");

    const config = loadConfig({ INIT_CWD: dir });

    assert.equal(config.slackBotToken, "xoxb-test");
    assert.equal(config.slackTestChannelId, "C123");
    assert.equal(config.port, 3999);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
