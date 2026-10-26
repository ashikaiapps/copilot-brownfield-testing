import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const revision = process.env.REVISION;
if (!/^[a-f0-9]{40}$/.test(revision || "")) {
  throw new Error("REVISION must be a full Git commit SHA.");
}

const publicFiles = [
  ["index.html", "index.html"],
  ["playbook.md", "playbook.md"],
  [join(".github", "agents", "brownfield-testing.agent.md"), join("downloads", "brownfield-testing.agent.md")],
];
const contents = await Promise.all(publicFiles.map(async ([source, destination]) => ({
  destination,
  bytes: await readFile(source),
})));

// A fresh staging directory prevents stale or unapproved files from being published.
await mkdir("_site");
await mkdir(join("_site", "downloads"));
for (const { destination, bytes } of contents) {
  await writeFile(join("_site", destination), bytes);
}
await writeFile(join("_site", "version.json"), JSON.stringify({ sha: revision }) + "\n");
console.log("Staged presentation, handout, canonical agent download, and revision.");
