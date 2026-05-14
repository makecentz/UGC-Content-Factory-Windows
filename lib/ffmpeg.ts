import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { logError } from "./logger";
import { mediaToolMissingMessage, resolveMediaToolPath } from "./media-tools";

export type FfmpegCheck = { installed: boolean; version?: string; message: string };

export type RenderOptions = {
  backgroundPath?: string | null;
  voiceoverPath?: string | null;
  musicPath?: string | null;
  captionsPath?: string | null;
  watermarkPath?: string | null;
  watermarkPosition?: string | null;
  watermarkOpacity?: number | null;
  outputPath: string;
  durationSeconds: number;
  effects?: string[];
  aspectRatio?: "9:16" | "16:9";
};

function ffmpegPath() {
  return resolveMediaToolPath("ffmpeg", process.env.FFMPEG_PATH);
}

function ffprobePath() {
  return resolveMediaToolPath("ffprobe", process.env.FFPROBE_PATH);
}

let filterListCache: string | null = null;

export async function checkFfmpegInstalled(): Promise<FfmpegCheck> {
  return new Promise((resolve) => {
    execFile(ffmpegPath(), ["-version"], (error, stdout) => {
      if (error) {
        resolve({
          installed: false,
          message: mediaToolMissingMessage("ffmpeg")
        });
        return;
      }
      resolve({ installed: true, version: stdout.split("\n")[0], message: "FFmpeg is installed." });
    });
  });
}

async function ffmpegHasFilter(filterName: string) {
  if (!filterListCache) {
    filterListCache = await new Promise((resolve) => {
      execFile(ffmpegPath(), ["-hide_banner", "-filters"], (error, stdout) => {
        resolve(error ? "" : stdout);
      });
    });
  }
  return new RegExp(`\\s${filterName}\\s`).test(filterListCache ?? "");
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath(), args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (data) => {
      stderr += String(data);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `FFmpeg exited with code ${code}`));
    });
  });
}

function ensureOutputDir(outputPath: string) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
}

export async function getMediaDuration(filePath: string) {
  return new Promise<number | null>((resolve) => {
    if (!existsSync(filePath)) {
      resolve(null);
      return;
    }

    execFile(
      ffprobePath(),
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        const duration = Number(stdout.trim());
        resolve(Number.isFinite(duration) && duration > 0 ? duration : null);
      }
    );
  });
}

async function hasAudioStream(filePath: string) {
  return new Promise<boolean>((resolve) => {
    if (!existsSync(filePath)) {
      resolve(false);
      return;
    }
    execFile(ffprobePath(), ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type", "-of", "csv=p=0", filePath], (error, stdout) => {
      resolve(!error && stdout.trim() === "audio");
    });
  });
}

function dimensionsForAspect(aspectRatio: "9:16" | "16:9" = "9:16") {
  return aspectRatio === "16:9" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
}

export function createKenBurnsBackground(backgroundPath: string | null | undefined, durationSeconds: number, effects: string[] = [], aspectRatio: "9:16" | "16:9" = "9:16") {
  if (!backgroundPath || !existsSync(backgroundPath)) {
    throw new Error(`Missing visual background file. Expected a valid image or video at ${backgroundPath || "(empty path)"}.`);
  }

  const videoFrames = Math.max(30, Math.ceil(durationSeconds * 30));
  const isVideo = /\.(mp4|mov|m4v|webm)$/i.test(backgroundPath);
  const vignette = effects.includes("Vignette") ? ",vignette=PI/5" : "";
  const grain = effects.includes("Film grain") ? ",noise=alls=8:allf=t+u" : "";
  const { width, height } = dimensionsForAspect(aspectRatio);
  const base = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;

  if (isVideo) {
    return {
      inputs: ["-stream_loop", "-1", "-i", backgroundPath],
      filter: `[0:v]${base}${vignette}${grain},fps=30,trim=duration=${durationSeconds},setpts=PTS-STARTPTS,format=yuv420p[v]`
    };
  }

  return {
    inputs: ["-loop", "1", "-i", backgroundPath],
    filter: `[0:v]${base},zoompan=z='min(zoom+0.0008,1.08)':d=${videoFrames}:s=${width}x${height}:fps=30,trim=duration=${durationSeconds},setpts=PTS-STARTPTS${vignette}${grain},format=yuv420p[v]`
  };
}

export function burnCaptions(captionsPath?: string | null) {
  if (!captionsPath || !existsSync(captionsPath)) return "";
  const escaped = path
    .resolve(captionsPath)
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");

  return `,ass=filename='${escaped}'`;
}

function assTimestampToSeconds(value: string) {
  const [hours = "0", minutes = "0", seconds = "0"] = value.split(":");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function splitAssDialogue(line: string) {
  const parts: string[] = [];
  let cursor = "";
  let commas = 0;

  for (const char of line.replace(/^Dialogue:\s*/, "")) {
    if (char === "," && commas < 9) {
      parts.push(cursor);
      cursor = "";
      commas += 1;
    } else {
      cursor += char;
    }
  }

  parts.push(cursor);
  return parts;
}

type CaptionOverlay = {
  path: string;
  start: number;
  end: number;
};

function wrapCaptionText(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 24 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function createCaptionOverlays(captionsPath?: string | null): Promise<CaptionOverlay[]> {
  if (process.env.REELPILOT_DISABLE_SHARP_CAPTION_OVERLAYS !== "false") return [];
  if (!captionsPath || !existsSync(captionsPath)) return [];
  const sharp = await import("sharp").then((mod) => mod.default);
  const tempDir = path.join(os.tmpdir(), "reelpilot-captions");
  mkdirSync(tempDir, { recursive: true });
  const baseName = path.basename(captionsPath, path.extname(captionsPath)).replace(/[^a-z0-9-]/gi, "") || "caption";
  const content = readFileSync(captionsPath, "utf8");
  const lines = content
    .split("\n")
    .filter((line) => line.startsWith("Dialogue:"))
    .map((line) => {
      const parts = splitAssDialogue(line);
      return {
        start: assTimestampToSeconds(parts[1] ?? "0:00:00.00"),
        end: assTimestampToSeconds(parts[2] ?? "0:00:00.00"),
        text: (parts[9] ?? "")
          .replace(/\{[^}]*\}/g, "")
          .replace(/\\N/g, " ")
          .trim()
      };
    })
    .filter((item) => item.text);

  return Promise.all(
    lines.map(async (line, index) => {
      const pngPath = path.join(tempDir, `${baseName}-${index}.png`);
      const textLines = wrapCaptionText(line.text);
      const firstY = 78 + Math.max(0, 2 - textLines.length) * 34;
      const tspans = textLines
        .map((text, lineIndex) => `<tspan x="540" y="${firstY + lineIndex * 82}">${escapeXml(text)}</tspan>`)
        .join("");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="300" viewBox="0 0 1080 300">
  <style>
    text { font-family: Arial, Helvetica, sans-serif; font-size: 72px; font-weight: 900; text-anchor: middle; dominant-baseline: middle; paint-order: stroke; stroke: #000; stroke-width: 12px; stroke-linejoin: round; fill: #fff; }
  </style>
  <text>${tspans}</text>
</svg>`;
      await sharp(Buffer.from(svg)).png().toFile(pngPath);
      return { path: pngPath, start: line.start, end: line.end };
    })
  );
}

function addCaptionOverlayFilters(baseLabel: string, overlays: CaptionOverlay[], firstOverlayInputIndex: number) {
  if (!overlays.length) return { filter: "", outputLabel: baseLabel };

  let current = baseLabel;
  const filters = overlays.map((overlay, index) => {
    const next = `vc${index}`;
    const filter = `[${current}][${firstOverlayInputIndex + index}:v]overlay=0:H-h-260:enable='between(t,${overlay.start.toFixed(2)},${overlay.end.toFixed(2)})'[${next}]`;
    current = next;
    return filter;
  });

  return { filter: `;${filters.join(";")}`, outputLabel: current };
}

export function mixAudio(hasVoice: boolean, hasMusic: boolean) {
  if (hasVoice && hasMusic) return "[1:a]volume=1.0,apad[a0];[2:a]volume=0.10[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[a]";
  if (hasVoice) return "[1:a]volume=1.0,apad[a]";
  if (hasMusic) return "[1:a]volume=0.18[a]";
  return "anullsrc=channel_layout=stereo:sample_rate=44100[a]";
}

export async function renderVerticalVideo(options: RenderOptions) {
  const check = await checkFfmpegInstalled();
  if (!check.installed) {
    throw new Error(`FFmpeg visual render failed. ${check.message}`);
  }

  const effects = options.effects ?? [];
  const background = createKenBurnsBackground(options.backgroundPath, options.durationSeconds, effects, options.aspectRatio);
  const hasVoice = Boolean(options.voiceoverPath && existsSync(options.voiceoverPath));
  const hasMusic = Boolean(options.musicPath && existsSync(options.musicPath));
  const hasWatermark = Boolean(options.watermarkPath && existsSync(options.watermarkPath));
  const useAssCaptions = Boolean(options.captionsPath && existsSync(options.captionsPath) && (await ffmpegHasFilter("ass")));
  const captionOverlays = useAssCaptions ? [] : await createCaptionOverlays(options.captionsPath);
  const inputs = [...background.inputs];

  if (hasVoice && options.voiceoverPath) inputs.push("-i", options.voiceoverPath);
  if (hasMusic && options.musicPath) inputs.push("-stream_loop", "-1", "-i", options.musicPath);
  const firstOverlayInputIndex = inputs.filter((input) => input === "-i").length;
  for (const overlay of captionOverlays) {
    inputs.push("-loop", "1", "-t", String(options.durationSeconds), "-i", overlay.path);
  }
  const watermarkInputIndex = inputs.filter((input) => input === "-i").length;
  if (hasWatermark && options.watermarkPath) inputs.push("-loop", "1", "-t", String(options.durationSeconds), "-i", options.watermarkPath);

  const videoBaseLabel = "vbase";
  const captionFilter = useAssCaptions ? burnCaptions(options.captionsPath) : "";
  const videoBaseFilter = background.filter.replace("[v]", `${captionFilter}[${videoBaseLabel}]`);
  const overlayFilters = addCaptionOverlayFilters(videoBaseLabel, captionOverlays, firstOverlayInputIndex);
  const watermarkPosition = options.watermarkPosition || "bottom-right";
  const watermarkX = watermarkPosition === "top-left" ? "54" : watermarkPosition === "bottom-center" ? "(W-w)/2" : "W-w-54";
  const watermarkY = watermarkPosition === "top-left" || watermarkPosition === "top-right" ? "54" : "H-h-54";
  const watermarkLabel = hasWatermark ? "vwatermark" : overlayFilters.outputLabel;
  const watermarkFilter = hasWatermark
    ? `;[${watermarkInputIndex}:v]scale=180:-1,format=rgba,colorchannelmixer=aa=${Math.max(0, Math.min(1, options.watermarkOpacity ?? 0.7)).toFixed(2)}[wm];[${overlayFilters.outputLabel}][wm]overlay=${watermarkX}:${watermarkY}:format=auto[${watermarkLabel}]`
    : "";
  const videoFilter = `${videoBaseFilter}${overlayFilters.filter}${watermarkFilter}`;
  const audioFilter = mixAudio(hasVoice, hasMusic);
  const filterComplex = `${videoFilter};${audioFilter}`;
  const outputDir = path.dirname(options.outputPath);
  ensureOutputDir(options.outputPath);

  const args = [
    "-y",
    ...inputs,
    "-filter_complex",
    filterComplex,
    "-map",
    `[${watermarkLabel}]`,
    "-map",
    "[a]",
    "-t",
    String(options.durationSeconds),
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-shortest",
    "-movflags",
    "+faststart",
    path.join(outputDir, path.basename(options.outputPath))
  ];

  const fileExists = (filePath?: string | null) => Boolean(filePath && existsSync(filePath));
  console.info("[ReelPilot] FFmpeg render inputs", {
    backgroundPath: options.backgroundPath,
    backgroundExists: fileExists(options.backgroundPath),
    voiceoverPath: options.voiceoverPath,
    voiceoverExists: fileExists(options.voiceoverPath),
    captionsPath: options.captionsPath,
    captionsExists: fileExists(options.captionsPath),
    watermarkPath: options.watermarkPath,
    watermarkExists: fileExists(options.watermarkPath),
    musicPath: options.musicPath,
    musicExists: fileExists(options.musicPath),
    outputPath: options.outputPath,
    durationSeconds: options.durationSeconds
  });
  console.info("[ReelPilot] FFmpeg args", [ffmpegPath(), ...args].join(" "));

  try {
    await runFfmpeg(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logError("FFmpeg visual render failed", error, {
      outputPath: options.outputPath,
      backgroundPath: options.backgroundPath,
      voiceoverPath: options.voiceoverPath,
      durationSeconds: options.durationSeconds,
      aspectRatio: options.aspectRatio
    });
    throw new Error(`FFmpeg visual render failed even though FFmpeg is installed. ${message}`);
  }

  return options.outputPath;
}

export async function concatSceneClips(scenePaths: string[], outputPath: string, aspectRatio: "9:16" | "16:9" = "9:16") {
  const existing = scenePaths.filter((scenePath) => existsSync(scenePath));
  if (!existing.length) throw new Error("No ready scene clips were found to stitch.");

  const listPath = path.join(os.tmpdir(), `reelpilot-concat-${Date.now()}.txt`);
  writeFileSync(listPath, existing.map((scenePath) => `file '${scenePath.replace(/'/g, "'\\''")}'`).join("\n"));
  const { width, height } = dimensionsForAspect(aspectRatio);
  ensureOutputDir(outputPath);

  const args = [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-vf",
    `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=30,format=yuv420p`,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    outputPath
  ];

  console.info("[ReelPilot] FFmpeg concat args", [ffmpegPath(), ...args].join(" "));
  try {
    await runFfmpeg(args);
  } catch (error) {
    await logError("FFmpeg scene concat failed", error, { outputPath, sceneCount: existing.length, aspectRatio });
    throw error;
  }
  return outputPath;
}

function wrapTitleText(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 22 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function escapeDrawtext(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/,/g, "\\,");
}

function escapeDrawtextPath(value: string) {
  return value.replace(/\\/g, "/").replace(/:/g, "\\:");
}

export async function renderTitleCardClip(title: string, outputPath: string, aspectRatio: "9:16" | "16:9" = "16:9", durationSeconds = 3.5) {
  const { width, height } = dimensionsForAspect(aspectRatio);
  ensureOutputDir(outputPath);
  if (!(await ffmpegHasFilter("drawtext"))) {
    throw new Error("This FFmpeg build does not include the drawtext filter needed for title pages.");
  }
  const titleLines = wrapTitleText(title.trim() || "Kids Story");
  const fontSize = aspectRatio === "16:9" ? 94 : 76;
  const lineHeight = Math.round(fontSize * 1.18);
  const firstY = Math.round(height / 2 - ((titleLines.length - 1) * lineHeight) / 2);
  const fontPath = ["C:\\Windows\\Fonts\\arialbd.ttf", "C:\\Windows\\Fonts\\arial.ttf"].find((candidate) => existsSync(candidate));
  const fontOption = fontPath ? `fontfile='${escapeDrawtextPath(fontPath)}':` : "";
  const fadeStart = Math.max(0.5, durationSeconds - 0.75).toFixed(2);
  const textFilters = titleLines.map((line, index) => {
    const y = firstY + index * lineHeight - Math.round(fontSize / 2);
    return `drawtext=${fontOption}text='${escapeDrawtext(line)}':fontcolor=white:fontsize=${fontSize}:borderw=7:bordercolor=0x111827:x=(w-text_w)/2:y=${y}`;
  });
  const videoFilter = [
    "fps=30",
    "drawbox=x=0:y=0:w=iw:h=ih:color=0x111827@0.16:t=fill",
    ...textFilters,
    `fade=t=out:st=${fadeStart}:d=0.75`,
    "format=yuv420p"
  ].join(",");
  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=0x7c3aed:s=${width}x${height}:d=${durationSeconds}`,
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-vf",
    videoFilter,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-shortest",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    outputPath
  ];

  console.info("[ReelPilot] FFmpeg title card args", [ffmpegPath(), ...args].join(" "));
  try {
    await runFfmpeg(args);
  } catch (error) {
    await logError("FFmpeg title card render failed", error, { outputPath, title, aspectRatio, durationSeconds });
    throw error;
  }
  return outputPath;
}

export async function normalizeVideoClip(inputPath: string, outputPath: string, aspectRatio: "9:16" | "16:9" = "9:16") {
  const { width, height } = dimensionsForAspect(aspectRatio);
  const hasAudio = await hasAudioStream(inputPath);
  ensureOutputDir(outputPath);
  const args = [
    "-y",
    "-i",
    inputPath,
    ...(hasAudio ? [] : ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]),
    "-vf",
    `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=30,format=yuv420p`,
    "-map",
    "0:v:0",
    "-map",
    hasAudio ? "0:a:0" : "1:a:0",
    "-shortest",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    outputPath
  ];
  try {
    await runFfmpeg(args);
  } catch (error) {
    await logError("FFmpeg clip normalization failed", error, { inputPath, outputPath, aspectRatio });
    throw error;
  }
  return outputPath;
}

export async function concatVideoFiles(videoPaths: string[], outputPath: string, aspectRatio: "9:16" | "16:9" = "9:16") {
  const existing = videoPaths.filter((videoPath) => existsSync(videoPath));
  if (!existing.length) throw new Error("No video files were found to stitch.");

  const tempDir = path.join(os.tmpdir(), `reelpilot-video-concat-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
  const normalized = await Promise.all(
    existing.map((videoPath, index) => normalizeVideoClip(videoPath, path.join(tempDir, `${index}.mp4`), aspectRatio))
  );
  const listPath = path.join(tempDir, "concat.txt");
  writeFileSync(listPath, normalized.map((videoPath) => `file '${videoPath.replace(/'/g, "'\\''")}'`).join("\n"));
  ensureOutputDir(outputPath);

  const args = [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    outputPath
  ];

  console.info("[ReelPilot] FFmpeg video concat args", [ffmpegPath(), ...args].join(" "));
  try {
    await runFfmpeg(args);
  } catch (error) {
    await logError("FFmpeg video concat failed", error, { outputPath, videoCount: existing.length, aspectRatio });
    throw error;
  }
  return outputPath;
}

export async function addTransitionsBetweenClips(scenePaths: string[], transitionStyle: string, outputPath: string, aspectRatio: "9:16" | "16:9" = "9:16") {
  if (transitionStyle.toLowerCase() !== "fade") {
    return concatSceneClips(scenePaths, outputPath, aspectRatio);
  }

  return concatSceneClips(scenePaths, outputPath, aspectRatio);
}

export async function renderFinalStoryVideo(options: {
  scenePaths: string[];
  voiceoverPath?: string | null;
  musicPath?: string | null;
  captionsPath?: string | null;
  outputPath: string;
  duration: number;
  transitionStyle?: string | null;
  watermarkPath?: string | null;
  watermarkPosition?: string | null;
  watermarkOpacity?: number | null;
  aspectRatio?: "9:16" | "16:9";
}) {
  const stitchedPath = path.join(os.tmpdir(), `reelpilot-story-scenes-${Date.now()}.mp4`);
  await addTransitionsBetweenClips(options.scenePaths, options.transitionStyle || "hard cut", stitchedPath, options.aspectRatio);
  return renderVerticalVideo({
    backgroundPath: stitchedPath,
    voiceoverPath: options.voiceoverPath,
    musicPath: options.musicPath,
    captionsPath: options.captionsPath,
    watermarkPath: options.watermarkPath,
    watermarkPosition: options.watermarkPosition,
    watermarkOpacity: options.watermarkOpacity,
    outputPath: options.outputPath,
    durationSeconds: options.duration,
    effects: [],
    aspectRatio: options.aspectRatio
  });
}
