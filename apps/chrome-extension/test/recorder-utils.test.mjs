import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadUtils(elementMap = new Map()) {
  const context = {
    globalThis: {},
    CSS: { escape: (value) => String(value).replace(/"/g, '\\"') },
    document: {
      querySelector(selector) {
        return elementMap.get(selector) || null;
      }
    }
  };
  context.globalThis = context;
  const source = readFileSync(new URL("../recorder-utils.js", import.meta.url), "utf8");
  vm.runInNewContext(source, context);
  return context.TrailwiseRecorder;
}

function element(attrs = {}, tagName = "INPUT") {
  return {
    tagName,
    id: attrs.id || "",
    innerText: attrs.innerText || "",
    textContent: attrs.textContent || "",
    getAttribute(name) {
      return attrs[name] ?? null;
    },
    closest() {
      return attrs.closestReturn || null;
    },
    getBoundingClientRect() {
      return { x: 1, y: 2, width: 3, height: 4, top: 2, right: 4, bottom: 6, left: 1 };
    }
  };
}

test("selectorFor prefers data-testid", () => {
  const utils = loadUtils();
  assert.equal(utils.selectorFor(element({ "data-testid": "create-account", id: "x" }, "BUTTON")), '[data-testid="create-account"]');
});

test("selectorFor uses data-id for dynamic queue rows", () => {
  const utils = loadUtils();
  assert.equal(utils.selectorFor(element({ "data-id": "EXP-4821" }, "DIV")), '[data-id="EXP-4821"]');
});

test("describeElement includes implicit button role", () => {
  const utils = loadUtils();
  const described = utils.describeElement(element({ textContent: "Approve" }, "BUTTON"));
  assert.equal(described.role, "button");
  assert.equal(described.text, "Approve");
});

test("interactiveTargetFor climbs to clickable parent", () => {
  const utils = loadUtils();
  const row = element({ "data-id": "EXP-4821" }, "DIV");
  const child = element({ textContent: "Sarah Chen", closestReturn: row }, "DIV");
  assert.equal(utils.interactiveTargetFor(child), row);
});

test("redacts password fields", () => {
  const utils = loadUtils();
  const password = element({ type: "password", name: "password" });
  assert.equal(utils.isSensitiveElement(password), true);
  assert.equal(JSON.stringify(utils.normalizeInputValue(password)), JSON.stringify({ value_policy: "redacted", value: "[REDACTED]" }));
});

test("uses placeholders for normal text inputs", () => {
  const utils = loadUtils();
  const email = element({ type: "email", name: "email" });
  assert.equal(utils.isSensitiveElement(email), false);
  assert.equal(JSON.stringify(utils.normalizeInputValue(email)), JSON.stringify({ value_policy: "typed_text_placeholder", value: "[TYPED_TEXT]" }));
});
