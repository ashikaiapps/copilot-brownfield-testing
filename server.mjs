import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/playbook.md", ["playbook.md", "text/markdown; charset=utf-8"]],
  ["/downloads/brownfield-testing.agent.md", [".github/agents/brownfield-testing.agent.md", "text/markdown; charset=utf-8"]],
  ["/version.json", ["version.json", "application/json; charset=utf-8"]],
]);

createServer(async (request, response) => {
  const file = files.get(new URL(request.url, "http://localhost").pathname);
  if (!file) {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    const content = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, { "Content-Type": file[1] }).end(content);
  } catch (error) {
    console.error(`Cannot serve ${file[0]}:`, error.message);
    response.writeHead(500).end("Unable to read site file");
  }
}).listen(4173, "127.0.0.1", () => {
  console.log("Presentation: http://127.0.0.1:4173");
});
