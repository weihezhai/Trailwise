import { readFileSync } from "node:fs";

for (const file of ["index.html", "styles.css", "app.js"]) {
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
}

console.log("Demo site files are present.");
