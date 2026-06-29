import assert from "node:assert/strict";
import test from "node:test";
import { validateTrace } from "./validation.js";
import type { WorkflowTrace } from "./trace.js";

function baseTrace(events: WorkflowTrace["events"]): WorkflowTrace {
  return {
    schema_version: "0.1",
    session_id: "sess_test",
    platform: "macos",
    browser: "chrome",
    started_at: "2026-06-28T12:00:00Z",
    target_url: "http://localhost:5173",
    events
  };
}

test("validates a minimal trace", () => {
  const result = validateTrace(
    baseTrace([
      {
        seq: 1,
        type: "session_started",
        ts: 0,
        url: "http://localhost:5173"
      }
    ])
  );

  assert.equal(result.valid, true, result.errors.join("\n"));
});

test("rejects sensitive input without redaction or synthetic policy", () => {
  const result = validateTrace(
    baseTrace([
      {
        seq: 1,
        type: "input",
        ts: 10,
        selector: "input[name=\"password\"]",
        value_policy: "typed_text_placeholder",
        value: "[TYPED_TEXT]"
      }
    ])
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /appears sensitive/);
});

test("accepts redacted sensitive input", () => {
  const result = validateTrace(
    baseTrace([
      {
        seq: 1,
        type: "input",
        ts: 10,
        selector: "input[name=\"password\"]",
        value_policy: "redacted",
        value: "[REDACTED]"
      }
    ])
  );

  assert.equal(result.valid, true, result.errors.join("\n"));
});
