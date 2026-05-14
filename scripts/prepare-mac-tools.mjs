import { access, chmod, copyFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const vendorDir = join(root, "vendor", "mac");

async function exists(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function which(command) {
  const result = spawnSync("which", [command], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

async function copyExecutable(command) {
  const source = which(command);
  if (!source || !(await exists(source))) {
    throw new Error(`Could not find ${command}. Install it with Homebrew, then run the mac installer build again.`);
  }

  const destination = join(vendorDir, command);
  await copyFile(source, destination);
  await chmod(destination, 0o755);
  console.log(`Bundled ${command}: ${source} -> ${destination}`);
}

await mkdir(vendorDir, { recursive: true });
await copyExecutable("ffmpeg");
await copyExecutable("ffprobe");
await copyExecutable("yt-dlp");
