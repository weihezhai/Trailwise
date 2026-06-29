import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JsonStore } from "./store.js";

test("creates and updates a session", () => {
  const dir = mkdtempSync(join(tmpdir(), "trailwise-store-"));
  try {
    const store = new JsonStore(join(dir, "store.json"));
    const session = store.createSession({
      slack_team_id: "T",
      slack_channel_id: "C",
      slack_user_id: "U",
      target_url: "http://localhost:5173"
    });

    assert.equal(session.status, "pending_local_confirmation");
    store.updateSession(session.session_id, { status: "recording" });
    assert.equal(store.getSession(session.session_id).status, "recording");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
