import { existsSync } from "node:fs";
import { prisma } from "./prisma";
import { generateVideoScript, generateVoiceover } from "./openai";
import { writeCaptionFiles } from "./captions";
import { ensureStorage, safeFileName, saveBuffer, storagePath } from "./storage";
import { getMediaDuration, renderVerticalVideo } from "./ffmpeg";
import { selectFallbackBackground } from "./backgrounds";
import { generateStoryVideo } from "./scene-pipeline";

export function durationToSeconds(duration: string) {
  if (duration.includes("20-30")) return 28;
  if (duration.includes("30-40")) return 38;
  if (duration.includes("45-60")) return 55;
  if (duration.includes("60-90")) return 75;
  return 30;
}

function parseEffects(effects: string) {
  try {
    const parsed = JSON.parse(effects);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function musicPathForSeries(backgroundMusic?: string | null) {
  if (!backgroundMusic || backgroundMusic === "none") return null;
  if (backgroundMusic.startsWith("/")) return backgroundMusic;
  const maybeFile = storagePath("music", `${safeFileName(backgroundMusic)}.mp3`);
  return maybeFile;
}

export async function generateVideoForSeries(seriesId: string) {
  await ensureStorage();
  const series = await prisma.series.findUnique({ where: { id: seriesId } });
  if (!series) throw new Error("Series not found.");

  const placeholderTitle = `Generating ${series.name}`;
  const video = await prisma.video.create({
    data: {
      seriesId: series.id,
      title: placeholderTitle,
      script: "",
      status: "generating"
    }
  });

  try {
    const generated = await generateVideoScript(series);
    const targetDurationSeconds = durationToSeconds(series.videoDuration);
    const base = `${safeFileName(generated.title || series.name)}-${video.id.slice(0, 8)}`;
    const voiceoverBuffer = await generateVoiceover(generated.script, series.voice);
    const voiceoverPath = await saveBuffer("voiceovers", `${base}.mp3`, voiceoverBuffer);
    const voiceoverDuration = await getMediaDuration(voiceoverPath);
    const durationSeconds = Math.max(1, Math.ceil((voiceoverDuration ?? targetDurationSeconds) + 0.25));
    const captions = await writeCaptionFiles(video.id, generated.script, durationSeconds, series.captionStyle);
    const outputPath = storagePath("exports", `${base}.mp4`);
    const musicPath = musicPathForSeries(series.backgroundMusic);
    const backgroundPath = await selectFallbackBackground(series.artStyle, series.customNiche || series.niche);
    const mode = series.generationMode === "background" ? "background" : "story-video";

    if (!existsSync(backgroundPath)) {
      throw new Error(`No visual background found for this render. Expected a fallback background at ${backgroundPath}.`);
    }

    await prisma.video.update({
      where: { id: video.id },
      data: {
        title: generated.title,
        hook: generated.hook,
        script: generated.script,
        description: generated.description,
        hashtags: generated.hashtags,
        voiceoverPath,
        backgroundPath,
        musicPath,
        captionsPath: captions.assPath,
        finalVideoPath: outputPath,
        mode,
        status: "generating"
      }
    });

    if (mode === "story-video") {
      try {
        await generateStoryVideo(video.id, durationSeconds);
      } catch (storyError) {
        console.warn("[ReelPilot] Story Video Mode failed, falling back to background render", storyError);
        await renderVerticalVideo({
          backgroundPath,
          voiceoverPath,
          musicPath,
          captionsPath: captions.assPath,
          outputPath,
          durationSeconds,
          effects: parseEffects(series.effects)
        });
      }
    } else {
      await renderVerticalVideo({
        backgroundPath,
        voiceoverPath,
        musicPath,
        captionsPath: captions.assPath,
        outputPath,
        durationSeconds,
        effects: parseEffects(series.effects)
      });
    }

    return prisma.video.update({
      where: { id: video.id },
      data: {
        title: generated.title,
        hook: generated.hook,
        script: generated.script,
        description: generated.description,
        hashtags: generated.hashtags,
        voiceoverPath,
        backgroundPath,
        musicPath,
        captionsPath: captions.assPath,
        finalVideoPath: outputPath,
        mode,
        status: "ready"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return prisma.video.update({
      where: { id: video.id },
      data: {
        status: "failed",
        title: placeholderTitle,
        errorMessage: message
      }
    });
  }
}

export async function ensureTestSeries() {
  const existing = await prisma.series.findFirst({ where: { niche: "Strange Facts" } });
  if (existing) return existing;
  return prisma.series.create({
    data: {
      name: "Strange Facts Test Flight",
      niche: "Strange Facts",
      language: "English",
      voice: "Onyx - deep dramatic male",
      artStyle: "Cinematic Realism",
      captionStyle: "Bold Stroke",
      backgroundMusic: "none",
      effects: JSON.stringify(["Zoom motion", "Vignette"]),
      videoDuration: "20-30 seconds",
      postingFrequency: "Manual only",
      generationMode: "story-video",
      videoProvider: "veo3",
      useSceneConsistency: true,
      preferredSceneDuration: 5,
      transitionStyle: "hard cut",
      storyboardEnabled: true,
      autoGenerate: false
    }
  });
}
