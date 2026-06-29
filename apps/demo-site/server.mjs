import http from "node:http";
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";

const port = Number(process.env.DEMO_SITE_PORT || 5173);
const root = new URL(".", import.meta.url);

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"]
]);

http
  .createServer((request, response) => {
    const url = new URL(request.url || "/", `http://localhost:${port}`);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    try {
      const file = readFileSync(join(root.pathname, path));
      response.writeHead(200, { "Content-Type": types.get(extname(path)) || "application/octet-stream" });
      response.end(file);
    } catch {
      response.writeHead(404);
      response.end("not found");
    }
  })
  .listen(port, () => {
    console.log(`Trailwise demo site running at http://localhost:${port}`);
  });
