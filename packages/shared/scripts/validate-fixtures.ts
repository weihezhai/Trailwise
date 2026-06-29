import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateTrace } from "../src/validation.js";

const fixturePath = resolve(process.cwd(), "../../fixtures/traces/minimal-trace.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const result = validateTrace(fixture);

if (!result.valid) {
  console.error(result.errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${fixturePath}`);
