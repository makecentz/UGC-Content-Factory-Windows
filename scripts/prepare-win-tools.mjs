import { createWriteStream, existsSync, mkdirSync, rmSync } from "node:fs";
import { readdir, copyFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { pipeline } from "node:stream/promises";
import extract from "extract-zip";

const root = process.cwd();
const vendorDir = join(root, "vendor", "win");
const tempDir = join(root, ".electron-tools");
const ffmpegZip = join(tempDir, "ffmpeg-release-essentials.zip");
const ytDlpExe = join(vendorDir, "yt-dlp.exe");

const downloads = {
  ffmpeg: "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
  ytDlp: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
};

mkdirSync(vendorDir, { recursive: true });
mkdirSync(tempDir, { recursive: true });

async function download(url, target) {
  if (existsSync(target)) return;
  console.log(`Downloading ${basename(target)}...`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed for ${url}: ${response.status} ${response.statusText}`);
  }
  await pipeline(response.body, createWriteStream(target));
}

async function findFile(dir, fileName) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findFile(fullPath, fileName);
      if (found) return found;
    } else if (entry.name.toLowerCase() === fileName.toLowerCase()) {
      return fullPath;
    }
  }
  return null;
}

async function prepareFfmpeg() {
  const ffmpegTarget = join(vendorDir, "ffmpeg.exe");
  const ffprobeTarget = join(vendorDir, "ffprobe.exe");
  if (existsSync(ffmpegTarget) && existsSync(ffprobeTarget)) return;

  await download(downloads.ffmpeg, ffmpegZip);
  const extractDir = join(tempDir, "ffmpeg");
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });
  await extract(ffmpegZip, { dir: extractDir });

  const ffmpeg = await findFile(extractDir, "ffmpeg.exe");
  const ffprobe = await findFile(extractDir, "ffprobe.exe");
  if (!ffmpeg || !ffprobe) throw new Error("Could not find ffmpeg.exe and ffprobe.exe in the downloaded archive.");
  await copyFile(ffmpeg, ffmpegTarget);
  await copyFile(ffprobe, ffprobeTarget);
}

await prepareFfmpeg();
await download(downloads.ytDlp, ytDlpExe);
console.log("Windows media tools are ready in vendor/win.");
