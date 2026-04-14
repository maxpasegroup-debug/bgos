/**
 * One-off: replace fetch(…/api/…) with apiFetch and ensure @/lib/api-fetch import.
 * Skips src/lib/api-fetch.ts (uses native fetch).
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "src");
const skipFiles = new Set([path.normalize(path.join(root, "lib", "api-fetch.ts"))]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function ensureApiFetchImport(source) {
  if (!source.includes("apiFetch(")) return source;

  const importLine = 'import { apiFetch } from "@/lib/api-fetch";\n';
  const expandExisting = source.replace(
    /import\s*\{\s*([^}]*)\}\s*from\s*["']@\/lib\/api-fetch["'];?/,
    (m, inner) => {
      if (/\bapiFetch\b/.test(inner)) return m;
      const trimmed = inner.trim();
      const names = trimmed ? `${trimmed}, apiFetch` : "apiFetch";
      return `import { ${names} } from "@/lib/api-fetch";`;
    },
  );
  if (expandExisting !== source) return expandExisting;

  const useClient = /^"use client";?\s*\n/m.exec(source) || /^'use client';?\s*\n/m.exec(source);
  if (useClient) {
    const idx = useClient.index + useClient[0].length;
    return source.slice(0, idx) + "\n" + importLine + source.slice(idx);
  }
  const firstImport = source.match(/^import\s/m);
  if (firstImport) {
    const idx = firstImport.index;
    return source.slice(0, idx) + importLine + source.slice(idx);
  }
  return importLine + source;
}

for (const file of walk(root)) {
  if (skipFiles.has(path.normalize(file))) continue;
  let s = fs.readFileSync(file, "utf8");
  if (!/\bfetch\s*\(\s*["'`]\/api\//.test(s)) continue;

  const orig = s;
  s = s.replace(/\bfetch\s*\(\s*(["'`]\/api\/)/g, "apiFetch($1");

  if (s === orig) continue;
  s = ensureApiFetchImport(s);
  fs.writeFileSync(file, s);
  console.log("updated", path.relative(process.cwd(), file));
}
