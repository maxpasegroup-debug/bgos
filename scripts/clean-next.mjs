import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), ".next");
if (fs.existsSync(dir)) {
  try {
    fs.rmSync(dir, {
      recursive: true,
      force: true,
      // Handles transient EBUSY/ENOTEMPTY on container/overlay filesystems.
      maxRetries: 20,
      retryDelay: 100,
    });
    console.log("[clean-next] removed .next");
  } catch (e) {
    const err = e;
    if (err && typeof err === "object" && "code" in err && err.code === "EBUSY") {
      console.warn("[clean-next] .next is busy/locked; skipping hard delete and continuing build.");
    } else {
      throw e;
    }
  }
}
