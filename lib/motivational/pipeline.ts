import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { createAssFile, createSrtFile, splitScriptIntoCaptionChunks } from "@/lib/captions";
import { getMediaDuration, renderFinalStoryVideo } from "@/lib/ffmpeg";
import { generateVoiceover } from "@/lib/openai";
import { getVideoProvider } from "@/lib/providers";
import { checkSceneQuality } from "@/lib/scene-quality";
import { ensureStorage, safeFileName, storagePath } from "@/lib/storage";
import { generateMotivationalScript } from "./script-generator";
import { generateMotivationalStoryboard, motivationalDurationToSeconds } from "./storyboard";
import { transcribeMotivationalYouTubeUrl } from "./youtube";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeMotivationalCaptions(projectId: string, script: string, durationSeconds: number, style: string) {
  const chunks = splitScriptIntoCaptionChunks(script, durationSeconds);
  const assPath = storagePath("motivational/captions", `${projectId}.ass`);
  const srtPath = storagePath("motivational/captions", `${projectId}.srt`);
  await Promise.all([writeFile(assPath, createAssFile(chunks, style)), writeFile(srtPath, createSrtFile(chunks))]);
  return assPath;
}

function buildMotivationalScenePrompt(input: {
  prompt: string;
  visualDescription?: string | null;
  camera?: string | null;
  mood?: string | null;
  style: string;
}) {
  return `${input.prompt}

Scene detail: ${input.visualDescription || "high-stakes cinematic motivational turning point"}
Camera: ${input.camera || "dramatic handheld push-in, low angle hero framing, fast emotional cutaways"}
Mood: ${input.mood || "intense, dramatic, determined, resilient"}
Style: ${input.style}

Generate a vertical 1080x1920 YouTube Shorts video shot. 8K photorealistic, dramatic cinematic motivational video, authentic human emotion, natural motion, bold contrast, rain/sweat/shadows/golden backlight when appropriate, powerful close-ups, high-stakes comeback energy, heroic but realistic composition. No visible text, no captions, no subtitles, no logos, no watermarks, no readable phone or computer screens.`;
}

async function getSourceTranscript(project: {
  id: string;
  youtubeUrl?: string | null;
  sourceTranscript?: string | null;
  pastedScript?: string | null;
  prompt?: string | null;
}) {
  if (project.sourceTranscript?.trim()) return project.sourceTranscript.trim();
  if (!project.youtubeUrl?.trim()) return null;
  try {
    const transcript = await transcribeMotivationalYouTubeUrl(project.youtubeUrl, project.id);
    await prisma.motivationalShortProject.update({ where: { id: project.id }, data: { sourceTranscript: transcript } });
    return transcript;
  } catch (error) {
    if (project.pastedScript?.trim() || project.prompt?.trim()) return null;
    throw error;
  }
}

export async function renderMotivationalScene(sceneId: string) {
  const scene = await prisma.motivationalShortScene.findUnique({ where: { id: sceneId }, include: { motivationalShortProject: true } });
  if (!scene) throw new Error("Motivational scene not found.");
  const provider = getVideoProvider(scene.motivationalShortProject.videoProvider);
  const prompt = buildMotivationalScenePrompt({
    prompt: scene.editedPrompt || scene.prompt,
    visualDescription: scene.visualDescription,
    camera: scene.camera,
    mood: scene.mood,
    style: scene.motivationalShortProject.style
  });
  const maxAttempts = 3;
  let lastError = "";

  await prisma.motivationalShortScene.update({
    where: { id: scene.id },
    data: { status: scene.clipPath ? "regenerating" : "generating", approved: false, errorMessage: null }
  });

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      if (attempt > 0) {
        await prisma.motivationalShortScene.update({ where: { id: scene.id }, data: { retryCount: { increment: 1 }, status: "regenerating" } });
      }
      const job = await provider.generateSceneClip({
        prompt,
        duration: scene.duration,
        aspectRatio: "9:16",
        style: scene.motivationalShortProject.style,
        projectType: "motivational-short",
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        narration: scene.narration
      });
      let status = await provider.getSceneClipStatus(job.jobId);
      const maxPolls = provider.name === "mock" ? 1 : 42;
      for (let poll = 0; status.status === "generating" && poll < maxPolls; poll += 1) {
        await wait(10_000);
        status = await provider.getSceneClipStatus(job.jobId);
        await prisma.motivationalShortScene.update({
          where: { id: scene.id },
          data: { status: status.status, provider: provider.name, providerJobId: job.jobId, errorMessage: status.errorMessage || null }
        });
      }
      if (status.status !== "ready") throw new Error(status.errorMessage || "Motivational scene generation did not complete in time.");

      const outputPath = provider.name.startsWith("local-comfyui")
        ? storagePath("scenes/local-wan", `${scene.id}.mp4`)
        : storagePath("motivational/scenes", `${scene.sceneNumber}-${scene.id}-${provider.name}.mp4`);
      const clipPath = await provider.downloadSceneClip(job.jobId, outputPath);
      const quality = await checkSceneQuality(clipPath, scene.duration);
      if (!quality.ok) throw new Error(`Scene quality check failed: ${quality.errors.join(" ")}`);

      return prisma.motivationalShortScene.update({
        where: { id: scene.id },
        data: { status: "ready", approved: true, provider: provider.name, providerJobId: job.jobId, clipPath, errorMessage: null }
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < maxAttempts - 1) await wait(1500);
    }
  }

  return prisma.motivationalShortScene.update({ where: { id: scene.id }, data: { status: "failed", errorMessage: lastError } });
}

export async function renderMotivationalFinalVideo(projectId: string) {
  const project = await prisma.motivationalShortProject.findUnique({
    where: { id: projectId },
    include: { scenes: { orderBy: { sceneNumber: "asc" } } }
  });
  if (!project) throw new Error("Motivational short project not found.");
  const usable = project.scenes.filter((scene) => scene.clipPath && existsSync(scene.clipPath) && ["ready", "approved"].includes(scene.status));
  if (!usable.length) throw new Error("No ready motivational scenes are available to render.");
  const outputPath = project.finalVideoPath || storagePath("motivational/exports", `${safeFileName(project.title)}-${project.id.slice(0, 8)}.mp4`);
  const duration = Math.ceil((await getMediaDuration(project.voiceoverPath || "")) || motivationalDurationToSeconds(project.duration));

  await renderFinalStoryVideo({
    scenePaths: usable.map((scene) => scene.clipPath as string),
    voiceoverPath: project.voiceoverPath,
    musicPath: null,
    captionsPath: project.captionsEnabled ? project.captionsPath : null,
    watermarkPath: project.watermarkPath,
    watermarkPosition: project.watermarkPosition,
    watermarkOpacity: 0.89,
    outputPath,
    duration,
    transitionStyle: "hard cut",
    aspectRatio: "9:16"
  });

  return prisma.motivationalShortProject.update({ where: { id: project.id }, data: { status: "rendered", finalVideoPath: outputPath, errorMessage: null } });
}

export async function generateMotivationalShort(projectId: string) {
  await ensureStorage();
  const project = await prisma.motivationalShortProject.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Motivational short project not found.");

  try {
    await prisma.motivationalShortProject.update({ where: { id: project.id }, data: { status: "generating", errorMessage: null } });
    const transcript = await getSourceTranscript(project);
    const script = await generateMotivationalScript(project, transcript);
    const updatedProject = await prisma.motivationalShortProject.update({
      where: { id: project.id },
      data: {
        title: script.title || project.title,
        hook: script.hook,
        script: script.script,
        caption: script.caption,
        sourceTranscript: transcript || project.sourceTranscript
      }
    });

    const voiceover = await generateVoiceover(script.script, project.voice);
    const voiceoverPath = storagePath("motivational/voiceovers", `${safeFileName(updatedProject.title)}-${project.id.slice(0, 8)}.mp3`);
    await writeFile(voiceoverPath, voiceover);
    const voiceDuration = await getMediaDuration(voiceoverPath);
    const captionPath = project.captionsEnabled
      ? await writeMotivationalCaptions(project.id, script.script, Math.ceil((voiceDuration ?? motivationalDurationToSeconds(project.duration)) + 0.25), project.captionStyle)
      : null;
    const projectWithVoice = await prisma.motivationalShortProject.update({
      where: { id: project.id },
      data: { voiceoverPath, captionsPath: captionPath }
    });

    const storyboard = await generateMotivationalStoryboard(projectWithVoice);
    await prisma.motivationalShortScene.deleteMany({ where: { motivationalShortProjectId: project.id } });
    const scenes = await prisma.$transaction(
      storyboard.scenes.map((scene) =>
        prisma.motivationalShortScene.create({
          data: {
            motivationalShortProjectId: project.id,
            sceneNumber: scene.sceneNumber,
            narration: scene.narration,
            prompt: scene.prompt,
            visualDescription: scene.visualDescription,
            camera: scene.camera,
            mood: scene.mood,
            duration: scene.duration,
            startTime: scene.startTime,
            endTime: scene.endTime,
            provider: project.videoProvider,
            status: "pending"
          }
        })
      )
    );
    await prisma.motivationalShortProject.update({ where: { id: project.id }, data: { storyboardJson: JSON.stringify(storyboard) } });

    for (const scene of scenes) {
      const rendered = await renderMotivationalScene(scene.id);
      if (rendered.status === "failed") throw new Error(rendered.errorMessage || `Motivational scene ${rendered.sceneNumber} failed.`);
    }

    return renderMotivationalFinalVideo(project.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return prisma.motivationalShortProject.update({ where: { id: project.id }, data: { status: "failed", errorMessage: message } });
  }
}
