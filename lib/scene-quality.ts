import { existsSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { getMediaDuration } from "./ffmpeg";
import { execFile } from "node:child_process";
import { resolveMediaToolPath } from "./media-tools";

export type SceneQualityReport = {
  ok: boolean;
  checks: Record<string, boolean | number | string | null>;
  errors: string[];
};

function ffmpegPath() {
  return resolveMediaToolPath("ffmpeg", process.env.FFMPEG_PATH);
}

function ffprobePath() {
  return resolveMediaToolPath("ffprobe", process.env.FFPROBE_PATH);
}

async function getVideoStream(filePath: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    execFile(
      ffprobePath(),
      ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", filePath],
      (error, stdout) => {
        if (error) return resolve(null);
        try {
          const stream = JSON.parse(stdout).streams?.[0];
          resolve(stream ? { width: Number(stream.width), height: Number(stream.height) } : null);
        } catch {
          resolve(null);
        }
      }
    );
  });
}

async function firstFrameMean(filePath: string): Promise<number | null> {
  const framePath = path.join(os.tmpdir(), `reelpilot-quality-${Date.now()}.png`);
  await new Promise<void>((resolve, reject) => {
    execFile(ffmpegPath(), ["-y", "-i", filePath, "-frames:v", "1", framePath], (error) => (error ? reject(error) : resolve()));
  });
  try {
    const stats = await sharp(framePath).stats();
    return stats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.mean, 0) / 3;
  } finally {
    await rm(framePath, { force: true });
  }
}

export async function checkSceneQuality(filePath: string, expectedDuration: number): Promise<SceneQualityReport> {
  const errors: string[] = [];
  const checks: SceneQualityReport["checks"] = { filePath };

  const exists = existsSync(filePath);
  checks.exists = exists;
  if (!exists) errors.push("Scene clip file does not exist.");
  if (!exists) return { ok: false, checks, errors };

  const size = statSync(filePath).size;
  checks.fileSize = size;
  if (size < 100_000) errors.push("Scene clip file is unusually small.");

  const duration = await getMediaDuration(filePath);
  checks.duration = duration;
  if (!duration || Math.abs(duration - expectedDuration) > Math.max(2, expectedDuration * 0.5)) {
    errors.push(`Scene duration ${duration ?? "unknown"}s is not close to expected ${expectedDuration}s.`);
  }

  const stream = await getVideoStream(filePath);
  checks.width = stream?.width ?? null;
  checks.height = stream?.height ?? null;
  const ratioOk = Boolean(stream && stream.height > stream.width && Math.abs(stream.width / stream.height - 9 / 16) < 0.08);
  checks.aspectRatioOk = ratioOk;
  if (!ratioOk) errors.push("Scene is not vertical 9:16 or close enough to normalize.");

  const mean = await firstFrameMean(filePath).catch(() => null);
  checks.firstFrameMean = mean;
  if (mean !== null && mean < 8) errors.push("First frame appears mostly black.");

  return { ok: errors.length === 0, checks, errors };
}
