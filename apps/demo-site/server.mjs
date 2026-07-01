import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.DEMO_SITE_PORT || 5173);
const root = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(root, "../..");

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"]
]);

http
  .createServer((request, response) => {
    const url = new URL(request.url || "/", `http://localhost:${port}`);
    const path = routePath(url.pathname);
    try {
      const absolutePath = resolve(path.root, normalize(`.${path.pathname}`));
      if (!absolutePath.startsWith(path.root)) throw new Error("invalid path");
      const file = readFileSync(absolutePath);
      response.writeHead(200, { "Content-Type": types.get(extname(path.pathname)) || "application/octet-stream" });
      response.end(file);
    } catch {
      response.writeHead(404);
      response.end("not found");
    }
  })
  .listen(port, () => {
    console.log(`Trailwise demo site running at http://localhost:${port}`);
    if (expenseFlowPath()) {
      console.log(`Expense flow demo running at http://localhost:${port}/expense-flow.html`);
    }
  });

function routePath(pathname) {
  if (pathname === "/expense-flow.html" || pathname === "/expenseflow_1.html") {
    const expensePath = expenseFlowPath();
    if (!expensePath) return { root: repoRoot, pathname: "/expense-flow.html" };
    return { root: repoRoot, pathname: `/${expensePath}` };
  }
  return { root, pathname: pathname === "/" ? "/index.html" : pathname };
}

function expenseFlowPath() {
  if (existsSync(join(repoRoot, "expense-flow.html"))) return "expense-flow.html";
  if (existsSync(join(repoRoot, "expenseflow_1.html"))) return "expenseflow_1.html";
  return undefined;
}
