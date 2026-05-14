import { checkFfmpegInstalled } from "../lib/ffmpeg";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    process.env[match[1]] ??= match[2].replace(/^"|"$/g, "");
  }
}

checkFfmpegInstalled()
  .then((result) => {
    if (result.installed) {
      console.log(`FFmpeg is installed: ${result.version ?? "version unavailable"}`);
      process.exit(0);
    }
    console.error(result.message);
    process.exit(1);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
