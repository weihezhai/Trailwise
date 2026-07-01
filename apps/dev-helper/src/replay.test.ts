import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { findLatestTracePath } from "./replay.js";

test("findLatestTracePath returns newest trace", () => {
  const dir = mkdtempSync(join(tmpdir(), "trailwise-replay-"));
  try {
    const oldTrace = join(dir, "sessions", "sess_old", "trace.json");
    const newTrace = join(dir, "sessions", "sess_new", "trace.json");
    mkdirSync(join(dir, "sessions", "sess_old"), { recursive: true });
    mkdirSync(join(dir, "sessions", "sess_new"), { recursive: true });
    writeFileSync(oldTrace, "{}\n");
    writeFileSync(newTrace, "{}\n");
    utimesSync(oldTrace, new Date("2026-01-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z"));
    utimesSync(newTrace, new Date("2026-01-02T00:00:00Z"), new Date("2026-01-02T00:00:00Z"));

    assert.equal(findLatestTracePath(dir), newTrace);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
