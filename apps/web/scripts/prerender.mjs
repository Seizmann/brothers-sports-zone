/**
 * Build-time prerender for the public pages (REQUIREMENT.md Section 13).
 * Runs after `vite build`: builds a small SSR bundle of prerender/entry.tsx
 * via the vite JS API, renders each public route to HTML, injects per-page
 * head tags, and writes dist/<route>/index.html. No new framework deps.
 */
import { build } from "vite";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(webDir, "dist");
const ssrDir = path.join(distDir, ".prerender");

// 1. Build the SSR entry bundle.
await build({
  root: webDir,
  logLevel: "warn",
  build: {
    ssr: path.join(webDir, "prerender", "entry.tsx"),
    outDir: ssrDir,
    emptyOutDir: true,
  },
});

// 2. Load it and render each public route.
const { renderPage, PUBLIC_PAGES, headTagsFor } = await import(
  pathToFileURL(path.join(ssrDir, "entry.js")).href
);

const template = readFileSync(path.join(distDir, "index.html"), "utf8");

function headHtml(page) {
  const tags = headTagsFor(page)
    .map((t) => {
      if (t.tag === "title") return `<title>${t.content}</title>`;
      const attrs = Object.entries(t.attrs)
        .map(([k, v]) => `${k}="${v.replace(/"/g, "&quot;")}"`)
        .join(" ");
      return t.content
        ? `<meta ${attrs} content="${t.content.replace(/"/g, "&quot;")}" />`
        : `<link ${attrs} />`;
    })
    .join("\n    ");
  return tags;
}

for (const page of PUBLIC_PAGES) {
  const body = renderPage(page.path);
  const html = template
    // Drop the template's static fallback description; the per-page one below
    // must stay the only description meta on prerendered pages.
    .replace(/<meta name="description"[^>]*>/, "")
    .replace(/<title>[\s\S]*?<\/title>/, headHtml(page))
    .replace(/<div id="root"><\/div>/, `<div id="root">${body}</div>`);
  const outDir = page.path === "/" ? distDir : path.join(distDir, page.path.replace(/^\//, ""));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "index.html"), html);
  console.log(`prerender: ${page.path} -> ${path.relative(distDir, path.join(outDir, "index.html"))}`);
}

// 3. Clean up the SSR bundle.
rmSync(ssrDir, { recursive: true, force: true });
console.log("prerender: done");
