import { readFile, writeFile } from "node:fs/promises";
import { Marked } from "marked";

const chapters = [
  "overview", "principles", "agenda", "guardrails", "tutorial", "coverage",
  "skills", "delivery", "demo", "pitfalls", "done", "references", "tools", "azure",
];
let stageOpen = false;
let headline = "";
const markdown = new Marked({
  renderer: {
    heading({ tokens, depth, text }) {
      const title = this.parser.parseInline(tokens);
      const stage = depth === 3 && /^Step (\d+)\./.exec(text);
      const chapter = depth === 2 && /^(\d+)\./.exec(text);
      const id = stage
        ? `stage-${stage[1]}`
        : chapter
          ? chapters[Number(chapter[1]) - 1]
          : text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (depth === 1) {
        if (headline) throw new Error("The presentation must have exactly one main heading");
        headline = `<h1 id="${id}">${title}</h1>`;
        return "";
      }
      let prefix = "";
      if (stageOpen && depth <= 3) {
        prefix = "</section>\n";
        stageOpen = false;
      }
      if (stage) {
        prefix += `<section data-stage="${stage[1]}" aria-labelledby="${id}">\n`;
        stageOpen = true;
      }
      return `${prefix}<h${depth} id="${id}">${title}</h${depth}>\n`;
    },
  },
});
const source = await readFile(new URL("./playbook.md", import.meta.url), "utf8");
const content = markdown.parse(source)
  .replaceAll("<table>", '<div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable reference table"><table>')
  .replaceAll("<th>", '<th scope="col">')
  .replaceAll("</table>", "</table></div>");
if (stageOpen) throw new Error("Unclosed tutorial stage");
if (!headline) throw new Error("Missing presentation heading");
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="An evidence-first, ten-stage GitHub Copilot brownfield testing playbook with practical prompts, Playwright, skills, and CI/CD.">
  <title>Brownfield testing with GitHub Copilot</title>
  <script>
  (() => {
    const param = new URLSearchParams(window.location.search).get("clawpilotTheme");
    const theme =
      param || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  })();
  </script>
  <style>
:root {
  color-scheme: light;
  --cp-bg: #f7f4ef;
  --cp-bg-elevated: #fcfbf8;
  --cp-surface: #ffffff;
  --cp-surface-soft: #f5f5f5;
  --cp-border: #dedede;
  --cp-border-strong: #919191;
  --cp-text: #242424;
  --cp-text-muted: #5c5c5c;
  --cp-text-soft: #6f6f6f;
  --cp-accent: #b11f4b;
  --cp-accent-hover: #9a1a41;
  --cp-accent-soft: rgba(177, 31, 75, 0.08);
  --cp-accent-fg: #ffffff;
  --cp-success: #16a34a;
  --cp-danger: #dc2626;
  --cp-warning: #f59e0b;
  --cp-link: #0078d4;
  --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.12);
  --cp-overlay: rgba(255, 255, 255, 0.8);
  --cp-panel: rgba(255, 255, 255, 0.86);
  --cp-panel-strong: rgba(255, 255, 255, 0.96);
  --cp-sheen: rgba(255, 255, 255, 0.55);
  --cp-highlight: rgba(177, 31, 75, 0.12);
}
html[data-theme="dark"] {
  color-scheme: dark;
  --cp-bg: #3d3b3a;
  --cp-bg-elevated: #343231;
  --cp-surface: #292929;
  --cp-surface-soft: #2e2e2e;
  --cp-border: #474747;
  --cp-border-strong: #5f5f5f;
  --cp-text: #dedede;
  --cp-text-muted: #919191;
  --cp-text-soft: #b0b0b0;
  --cp-accent: #fd8ea1;
  --cp-accent-hover: #fb7b91;
  --cp-accent-soft: rgba(253, 142, 161, 0.14);
  --cp-accent-fg: #1a1a1a;
  --cp-success: #4ade80;
  --cp-danger: #f87171;
  --cp-warning: #fbbf24;
  --cp-link: #4da6ff;
  --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
  --cp-overlay: rgba(41, 41, 41, 0.88);
  --cp-panel: rgba(41, 41, 41, 0.72);
  --cp-panel-strong: rgba(41, 41, 41, 0.96);
  --cp-sheen: rgba(255, 255, 255, 0.04);
  --cp-highlight: rgba(253, 142, 161, 0.12);
}
* { box-sizing: border-box; }
html { scroll-padding-top: 7rem; }
body { margin: 0; background: var(--cp-bg); color: var(--cp-text); font: 1.125rem/1.7 "Segoe UI", Aptos, Calibri, -apple-system, BlinkMacSystemFont, sans-serif; }
a { color: var(--cp-link); text-underline-offset: .2em; overflow-wrap: anywhere; }
a:hover { color: var(--cp-accent-hover); }
:focus-visible { outline: 3px solid var(--cp-accent); outline-offset: 4px; }
.skip { position: absolute; left: 1rem; top: -8rem; z-index: 3; background: var(--cp-surface); padding: .75rem; }
.skip:focus { top: .5rem; }
header { position: sticky; top: 0; z-index: 2; border-bottom: 1px solid var(--cp-border); background: var(--cp-bg-elevated); }
nav { max-width: 76rem; margin: auto; padding: .75rem 1.5rem; display: flex; flex-wrap: wrap; gap: .5rem 1.25rem; align-items: center; font-size: 1rem; }
nav strong { color: var(--cp-accent); margin-right: auto; }
nav a { padding: .25rem 0; }
main { max-width: 72rem; margin: 0 auto; padding: 3rem 2rem 5rem; }
.eyebrow { color: var(--cp-accent); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: .875rem; }
h1, h2, h3, h4 { line-height: 1.2; overflow-wrap: anywhere; }
h1 { font-size: clamp(2.25rem, 5vw, 4rem); max-width: 22ch; margin: 1rem 0 2rem; }
h2 { font-size: clamp(1.75rem, 3vw, 2.5rem); margin-top: 3.5rem; padding-top: 1rem; border-top: 3px solid var(--cp-accent); }
h3 { font-size: clamp(1.35rem, 2.5vw, 1.75rem); margin-top: 2rem; }
p, li { max-width: 85ch; }
li + li { margin-top: .5rem; }
blockquote { margin: 1.5rem 0; padding: 1rem 1.5rem; border-left: 4px solid var(--cp-accent); background: var(--cp-accent-soft); font-size: 1.25rem; }
blockquote p { margin: 0; }
hr { border: 0; border-top: 1px solid var(--cp-border); margin: 3rem 0; }
section[data-stage] { margin: 2rem 0; padding: .5rem 1.75rem 1.5rem; border: 1px solid var(--cp-border); border-radius: 16px; background: var(--cp-surface); }
code, pre { font-family: Consolas, "Courier New", Courier, monospace; font-size: .9375rem; }
code { overflow-wrap: anywhere; background: var(--cp-surface-soft); padding: .125rem .25rem; border-radius: .25rem; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 1rem 0; padding: 1.25rem; border: 1px solid var(--cp-border); border-radius: .625rem; background: var(--cp-surface-soft); line-height: 1.6; }
pre code { padding: 0; }
.copy-tools { display: flex; align-items: center; flex-wrap: wrap; gap: .5rem 1rem; }
button { font: inherit; font-size: 1rem; cursor: pointer; border: 1px solid var(--cp-accent); border-radius: .625rem; padding: .5rem 1rem; background: var(--cp-accent); color: var(--cp-accent-fg); }
button:hover { background: var(--cp-accent-hover); }
.copy-tools [role="status"] { font-size: 1rem; color: var(--cp-text); }
.table-scroll { max-width: 100%; overflow-x: auto; margin: 1.5rem 0; }
table { width: 100%; border-collapse: collapse; font-size: 1rem; }
th, td { text-align: left; vertical-align: top; padding: .75rem; border: 1px solid var(--cp-border); min-width: 8rem; }
th { background: var(--cp-surface-soft); }
footer { padding: 2rem; border-top: 1px solid var(--cp-border); text-align: center; color: var(--cp-text-muted); }
@media (max-width: 40rem) {
  header { position: static; }
  html { scroll-padding-top: 1rem; }
  main { padding: 1.5rem 1rem 3rem; }
  section[data-stage] { padding: .25rem 1rem 1rem; }
  nav { padding: .75rem 1rem; }
  nav strong { flex-basis: 100%; }
  pre { padding: .75rem; }
}
@media print {
  header, .skip, .copy-tools, footer, .eyebrow { display: none; }
  body { font-size: 11pt; }
  main { max-width: none; padding: 0; }
  h2, h3 { break-after: avoid; }
  pre, blockquote { break-inside: avoid; }
  section[data-stage] { border: 0; padding: 0; }
  .table-scroll { overflow: visible; }
  table { font-size: 9pt; }
  th, td { min-width: 0; overflow-wrap: anywhere; }
  a { color: var(--cp-text); }
}
  </style>
</head>
<body>
  <a class="skip" href="#main-content">Skip to content</a>
  <header>
    <nav aria-label="Presentation navigation">
      <strong>Evidence before automation</strong>
      <a href="#overview">Overview</a>
      <a href="#tutorial">10 stages</a>
      <a href="#coverage">Coverage</a>
      <a href="#skills">Skills</a>
      <a href="#demo">Demo &amp; CI</a>
      <a href="#tools">Test tools</a>
      <a href="#azure">Azure at scale</a>
      <a href="#references">References</a>
      <a href="playbook.md">Markdown handout</a>
    </nav>
  </header>
  <main id="main-content" tabindex="-1">
    <p class="eyebrow">GitHub Copilot / Brownfield testing / Practical playbook</p>
    ${headline}
    <p>Start with one business-critical journey. Prove the whole loop, then expand by risk.</p>
    <nav aria-label="Tutorial stages">
      <a href="#stage-1">1. Scope</a>
      <a href="#stage-2">2. Map</a>
      <a href="#stage-3">3. Contracts</a>
      <a href="#stage-4">4. Journeys</a>
      <a href="#stage-5">5. Strategy</a>
      <a href="#stage-6">6. Environment</a>
      <a href="#stage-7">7. Explore</a>
      <a href="#stage-8">8. Playwright</a>
      <a href="#stage-9">9. Confidence</a>
      <a href="#stage-10">10. CI/CD</a>
    </nav>
${content}
  </main>
  <footer>A practical GitHub Copilot testing playbook. <a href="#demo">Explore the delivery demonstration</a> or <a href="#main-content">back to top</a>.</footer>
  <script>
    document.querySelectorAll("pre").forEach((pre, index) => {
      const code = pre.querySelector("code");
      if (!code) return;
      const tools = document.createElement("div");
      tools.className = "copy-tools";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Copy text";
      button.setAttribute("aria-label", "Copy text block " + (index + 1));
      const status = document.createElement("span");
      status.setAttribute("role", "status");
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(code.textContent);
          status.textContent = "Copied text block " + (index + 1) + ".";
        } catch {
          status.textContent = "Copy failed. Select and copy the text manually.";
        }
      });
      tools.append(button, status);
      pre.before(tools);
    });
  </script>
</body>
</html>
`;
await writeFile(new URL("./index.html", import.meta.url), html);
console.log("Rendered the complete playbook to index.html.");
