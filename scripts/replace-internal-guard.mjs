import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../src/app/api/bgos/control");

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (p.endsWith(".ts") && !p.includes("clear-demo-data")) {
      let c = fs.readFileSync(p, "utf8");
      if (!c.includes("requireSuperBossApi")) continue;
      const n = c
        .replace(/requireSuperBossApi/g, "requireInternalPlatformApi")
        .replace(/from "@\/lib\/require-super-boss"/g, 'from "@/lib/require-internal-platform"');
      if (n !== c) fs.writeFileSync(p, n);
    }
  }
}

walk(root);
console.log("done");
