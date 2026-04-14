/**
 * Replace silent / generic "Network error" catches with logging + formatFetchFailure.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "src");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function ensureFormatFetchFailure(source) {
  if (!source.includes("formatFetchFailure(")) return source;
  if (/import\s*\{[^}]*\bformatFetchFailure\b[^}]*\}\s*from\s*["']@\/lib\/api-fetch["']/.test(source)) {
    return source;
  }
  const expanded = source.replace(
    /import\s*\{\s*([^}]*)\}\s*from\s*["']@\/lib\/api-fetch["'];?/,
    (m, inner) => {
      if (/\bformatFetchFailure\b/.test(inner)) return m;
      const t = inner.trim();
      return `import { ${t ? `${t}, formatFetchFailure` : "formatFetchFailure"} } from "@/lib/api-fetch";`;
    },
  );
  if (expanded !== source) return expanded;
  const line = 'import { formatFetchFailure } from "@/lib/api-fetch";\n';
  const uc = /^"use client";?\s*\n/m.exec(source) || /^'use client';?\s*\n/m.exec(source);
  if (uc) {
    const i = uc.index + uc[0].length;
    return source.slice(0, i) + "\n" + line + source.slice(i);
  }
  const fi = source.match(/^import\s/m);
  if (fi) return source.slice(0, fi.index) + line + source.slice(fi.index);
  return line + source;
}

const replacements = [
  [
    /catch\s*\{\s*\r?\n(\s*)setErr\("Network error"\);/g,
    'catch (e) {\n$1console.error("API ERROR:", e);\n$1setErr(formatFetchFailure(e, "Request failed"));',
  ],
  [
    /catch\s*\{\s*\r?\n(\s*)setErr\("Network error\."\);/g,
    'catch (e) {\n$1console.error("API ERROR:", e);\n$1setErr(formatFetchFailure(e, "Request failed"));',
  ],
  [
    /catch\s*\{\s*\r?\n(\s*)setErr\("Network error — check your connection\."\);/g,
    'catch (e) {\n$1console.error("API ERROR:", e);\n$1setErr(formatFetchFailure(e, "Request failed"));',
  ],
  [
    /catch\s*\{\s*\r?\n(\s*)setError\("Network error"\);/g,
    'catch (e) {\n$1console.error("API ERROR:", e);\n$1setError(formatFetchFailure(e, "Request failed"));',
  ],
  [
    /catch\s*\{\s*\r?\n(\s*)setError\("Network error\."\);/g,
    'catch (e) {\n$1console.error("API ERROR:", e);\n$1setError(formatFetchFailure(e, "Request failed"));',
  ],
  [
    /catch\s*\{\s*\r?\n(\s*)setFormError\("Network error"\);/g,
    'catch (e) {\n$1console.error("API ERROR:", e);\n$1setFormError(formatFetchFailure(e, "Request failed"));',
  ],
];

for (const file of walk(root)) {
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes("Network error")) continue;
  const orig = s;
  for (const [re, rep] of replacements) {
    s = s.replace(re, rep);
  }
  if (s === orig) continue;
  s = ensureFormatFetchFailure(s);
  fs.writeFileSync(file, s);
  console.log("fixed", path.relative(process.cwd(), file));
}
