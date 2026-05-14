import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

function commandExists(command) {
  const result = spawnSync(process.platform === "win32" ? "where.exe" : "which", [command], { encoding: "utf8" });
  return result.status === 0 && Boolean(result.stdout.trim());
}

function bundledWindowsToolsExist() {
  return existsSync(join(root, "vendor", "win", "ffmpeg.exe")) && existsSync(join(root, "vendor", "win", "ffprobe.exe")) && existsSync(join(root, "vendor", "win", "yt-dlp.exe"));
}

if (process.platform === "win32") {
  if (!bundledWindowsToolsExist()) {
    const result = spawnSync(process.execPath, [join(root, "scripts", "prepare-win-tools.mjs")], { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status || 1);
  }
  process.exit(0);
}

const missing = ["ffmpeg", "ffprobe", "yt-dlp"].filter((command) => !commandExists(command));
if (missing.length) {
  console.warn(`[ReelPilot] Missing media tools: ${missing.join(", ")}. Packaged Windows builds bundle these automatically; local development on this OS needs them on PATH.`);
}
