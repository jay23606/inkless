import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
createServer(async (request, response) => {
  try {
    const relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/+/, "") || "index.html";
    const path = normalize(join(root, relative));
    if (!path.startsWith(normalize(root)) || !(await stat(path)).isFile()) throw new Error("Not found");
    response.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream" });
    response.end(await readFile(path));
  } catch { response.writeHead(404); response.end("Not found"); }
}).listen(8000, () => console.log("Inkless: http://localhost:8000"));
