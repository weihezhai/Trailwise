import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedRecordingUrl } from "./allowlist.js";

test("allows exact configured origin", () => {
  assert.equal(isAllowedRecordingUrl("http://localhost:5173/signup", ["http://localhost:5173"]), true);
});

test("rejects unconfigured origin", () => {
  assert.equal(isAllowedRecordingUrl("https://example.com/signup", ["http://localhost:5173"]), false);
});

test("supports path-scoped patterns", () => {
  assert.equal(isAllowedRecordingUrl("https://demo.yourapp.com/onboarding/start", ["https://demo.yourapp.com/onboarding/*"]), true);
  assert.equal(isAllowedRecordingUrl("https://demo.yourapp.com/admin", ["https://demo.yourapp.com/onboarding/*"]), false);
});
