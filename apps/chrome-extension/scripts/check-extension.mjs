import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));

if (manifest.host_permissions.some((permission) => permission === "https://*/*" || permission === "http://*/*")) {
  throw new Error("Chrome extension must not request broad host permissions for the demo");
}

for (const file of ["background.js", "content-script.js", "recorder-utils.js"]) {
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
}

console.log("Chrome extension manifest and files are valid for local loading.");
