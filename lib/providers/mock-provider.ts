import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ensureDefaultBackgrounds, selectFallbackBackground } from "../backgrounds";
import { renderVerticalVideo } from "../ffmpeg";
import { getStylePreset } from "../style-presets";
import { storagePath } from "../storage";
import type { GenerateSceneClipInput, SceneClipJob, SceneClipStatus, VideoProvider } from "./video-provider";

const jobs = new Map<string, { outputPath: string; status: SceneClipStatus }>();

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrap(text: string, max = 28) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 5);
}

async function createMockSceneImage(input: GenerateSceneClipInput, outputPath: string) {
  await ensureDefaultBackgrounds();
  const lower = `${input.prompt} ${input.narration}`.toLowerCase();
  let backgroundPath = await selectFallbackBackground(input.style, lower);
  if (lower.includes("scary") || lower.includes("dark") || lower.includes("shadow")) {
    backgroundPath = await selectFallbackBackground("Dark Thriller", lower);
  }

  const size = input.aspectRatio === "16:9" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
  const background = await sharp(backgroundPath).resize(size.width, size.height, { fit: "cover" }).png().toBuffer();
  if (input.projectType === "kids-story") {
    const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">
      <rect width="${size.width}" height="${size.height}" fill="#000" opacity="0.08"/>
      <circle cx="${Math.round(size.width * 0.28)}" cy="${Math.round(size.height * 0.34)}" r="${Math.round(size.height * 0.18)}" fill="#fff7ad" opacity="0.34"/>
      <circle cx="${Math.round(size.width * 0.72)}" cy="${Math.round(size.height * 0.42)}" r="${Math.round(size.height * 0.14)}" fill="#7dd3fc" opacity="0.22"/>
      <path d="M0 ${Math.round(size.height * 0.78)} C ${Math.round(size.width * 0.22)} ${Math.round(size.height * 0.68)}, ${Math.round(size.width * 0.46)} ${Math.round(size.height * 0.86)}, ${size.width} ${Math.round(size.height * 0.72)} L ${size.width} ${size.height} L 0 ${size.height} Z" fill="#8bd36f" opacity="0.42"/>
    </svg>`;
    await sharp(background).composite([{ input: Buffer.from(overlay), top: 0, left: 0 }]).png().toFile(outputPath);
    return;
  }
  const preset = getStylePreset(input.style);
  const narrationLines = wrap(input.narration, 29);
  const promptLines = wrap(input.prompt.replace(/Vertical 9:16/i, "").slice(0, 210), 34);
  const narrationText = narrationLines.map((line, index) => `<tspan x="540" y="${930 + index * 68}">${escapeXml(line)}</tspan>`).join("");
  const promptText = promptLines.map((line, index) => `<tspan x="540" y="${1240 + index * 45}">${escapeXml(line)}</tspan>`).join("");

  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
    <rect width="1080" height="1920" fill="#000" opacity="0.16"/>
    <circle cx="540" cy="520" r="230" fill="#fff" opacity="0.10"/>
    <rect x="110" y="760" width="860" height="640" rx="44" fill="#000" opacity="0.36"/>
    <text x="540" y="700" font-family="Arial" font-size="42" font-weight="900" fill="#fff" text-anchor="middle" opacity="0.82">SCENE ${input.sceneNumber}</text>
    <text font-family="Arial" font-size="58" font-weight="900" fill="#fff" text-anchor="middle" paint-order="stroke" stroke="#000" stroke-width="8">${narrationText}</text>
    <text font-family="Arial" font-size="32" font-weight="700" fill="#E8E2F0" text-anchor="middle" opacity="0.88">${promptText}</text>
    <text x="540" y="1520" font-family="Arial" font-size="34" font-weight="800" fill="#fff" text-anchor="middle" opacity="0.72">${escapeXml(preset.name)}</text>
  </svg>`;

  await sharp(background).composite([{ input: Buffer.from(overlay), top: 0, left: 0 }]).png().toFile(outputPath);
}

export const mockProvider: VideoProvider = {
  name: "mock",
  async generateSceneClip(input: GenerateSceneClipInput): Promise<SceneClipJob> {
    const jobId = `mock-${input.sceneId}`;
    const imagePath = storagePath("temp", `${jobId}.png`);
    const outputPath = storagePath("scenes", `${input.sceneNumber}-${input.sceneId}.mp4`);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await createMockSceneImage(input, imagePath);
    await renderVerticalVideo({
      backgroundPath: imagePath,
      outputPath,
      durationSeconds: input.duration,
      effects: ["Zoom motion", "Vignette"],
      aspectRatio: input.aspectRatio
    });
    jobs.set(jobId, { outputPath, status: { status: "ready", progress: 100, downloadUrl: outputPath } });
    return { jobId };
  },
  async getSceneClipStatus(jobId: string): Promise<SceneClipStatus> {
    return jobs.get(jobId)?.status ?? { status: "ready", progress: 100 };
  },
  async downloadSceneClip(jobId: string, outputPath: string) {
    const job = jobs.get(jobId);
    if (job?.outputPath && existsSync(job.outputPath)) return job.outputPath;
    return outputPath;
  }
};
