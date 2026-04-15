import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), ".next");
if (fs.existsSync(dir)) {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("[clean-next] removed .next");
}
