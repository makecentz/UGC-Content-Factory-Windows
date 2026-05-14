import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { getMediaDuration, renderFinalStoryVideo } from "@/lib/ffmpeg";
import { generateVoiceover } from "@/lib/openai";
import { getVideoProvider } from "@/lib/providers";
import { checkSceneQuality } from "@/lib/scene-quality";
import { ensureStorage, safeFileName, storagePath } from "@/lib/storage";
import { formatCharacterBibleForPrompt, generateDramaCharacterBible } from "./characters";
import { generateDramaScript } from "./script-generator";
import { dramaDurationToSeconds, generateDramaStoryboard } from "./storyboard";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDramaScenePrompt(input: {
  prompt: string;
  visualDescription?: string | null;
  camera?: string | null;
  mood?: string | null;
  style: string;
  characterBibleJson?: string | null;
}) {
  const characterContinuity = formatCharacterBibleForPrompt(input.characterBibleJson);
  return `${input.prompt}

${characterContinuity ? `${characterContinuity}\n` : ""}
Scene detail: ${input.visualDescription || "dramatic suspense scene"}
Camera: ${input.camera || "cinematic handheld camera"}
Mood: ${input.mood || "tense, mysterious, suspenseful"}
Style: ${input.style}

Generate a vertical 1080x1920 YouTube Shorts video shot. 8K photorealistic, cinematic drama, realistic people, natural motion, suspenseful lighting, shallow depth of field, high dynamic range. Keep the exact same cast identity across scenes. No visible text, no captions, no subtitles, no logos, no watermarks, no readable phone or computer screens.`;
}

export async function renderDramaScene(sceneId: string) {
  const scene = await prisma.dramaShortScene.findUnique({ where: { id: sceneId }, include: { dramaShortProject: true } });
  if (!scene) throw new Error("Drama scene not found.");
  const provider = getVideoProvider(scene.dramaShortProject.videoProvider);
  const prompt = buildDramaScenePrompt({
    prompt: scene.editedPrompt || scene.prompt,
    visualDescription: scene.visualDescription,
    camera: scene.camera,
    mood: scene.mood,
    style: scene.dramaShortProject.style,
    characterBibleJson: scene.dramaShortProject.characterBibleJson
  });
  const maxAttempts = 3;
  let lastError = "";

  await prisma.dramaShortScene.update({
    where: { id: scene.id },
    data: { status: scene.clipPath ? "regenerating" : "generating", approved: false, errorMessage: null }
  });

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      if (attempt > 0) {
        await prisma.dramaShortScene.update({ where: { id: scene.id }, data: { retryCount: { increment: 1 }, status: "regenerating" } });
      }
      const job = await provider.generateSceneClip({
        prompt,
        duration: scene.duration,
        aspectRatio: "9:16",
        style: scene.dramaShortProject.style,
        projectType: "drama-short",
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        narration: scene.narration
      });
      let status = await provider.getSceneClipStatus(job.jobId);
      const maxPolls = provider.name === "mock" ? 1 : 42;
      for (let poll = 0; status.status === "generating" && poll < maxPolls; poll += 1) {
        await wait(10_000);
        status = await provider.getSceneClipStatus(job.jobId);
        await prisma.dramaShortScene.update({
          where: { id: scene.id },
          data: { status: status.status, provider: provider.name, providerJobId: job.jobId, errorMessage: status.errorMessage || null }
        });
      }
      if (status.status !== "ready") throw new Error(status.errorMessage || "Drama short scene generation did not complete in time.");

      const outputPath = provider.name.startsWith("local-comfyui")
        ? storagePath("scenes/local-wan", `${scene.id}.mp4`)
        : storagePath("drama/scenes", `${scene.sceneNumber}-${scene.id}-${provider.name}.mp4`);
      const clipPath = await provider.downloadSceneClip(job.jobId, outputPath);
      const quality = await checkSceneQuality(clipPath, scene.duration);
      if (!quality.ok) throw new Error(`Scene quality check failed: ${quality.errors.join(" ")}`);

      return prisma.dramaShortScene.update({
        where: { id: scene.id },
        data: { status: "ready", approved: true, provider: provider.name, providerJobId: job.jobId, clipPath, errorMessage: null }
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < maxAttempts - 1) await wait(1500);
    }
  }

  return prisma.dramaShortScene.update({ where: { id: scene.id }, data: { status: "failed", errorMessage: lastError } });
}

export async function renderDramaFinalVideo(projectId: string) {
  const project = await prisma.dramaShortProject.findUnique({
    where: { id: projectId },
    include: { scenes: { orderBy: { sceneNumber: "asc" } } }
  });
  if (!project) throw new Error("Drama short project not found.");
  const usable = project.scenes.filter((scene) => scene.clipPath && existsSync(scene.clipPath) && ["ready", "approved"].includes(scene.status));
  if (!usable.length) throw new Error("No ready drama scenes are available to render.");
  const outputPath = project.finalVideoPath || storagePath("drama/exports", `${safeFileName(project.title)}-${project.id.slice(0, 8)}.mp4`);
  const duration = Math.ceil((await getMediaDuration(project.voiceoverPath || "")) || dramaDurationToSeconds(project.duration));

  await renderFinalStoryVideo({
    scenePaths: usable.map((scene) => scene.clipPath as string),
    voiceoverPath: project.voiceoverPath,
    musicPath: null,
    captionsPath: null,
    outputPath,
    duration,
    transitionStyle: "hard cut",
    aspectRatio: "9:16"
  });

  return prisma.dramaShortProject.update({ where: { id: project.id }, data: { status: "rendered", finalVideoPath: outputPath, errorMessage: null } });
}

export async function generateDramaShort(projectId: string) {
  await ensureStorage();
  const project = await prisma.dramaShortProject.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Drama short project not found.");

  try {
    await prisma.dramaShortProject.update({ where: { id: project.id }, data: { status: "generating", errorMessage: null } });
    const script = await generateDramaScript(project);
    const updatedProject = await prisma.dramaShortProject.update({
      where: { id: project.id },
      data: {
        title: script.title || project.title,
        hook: script.hook,
        script: script.script,
        caption: script.caption
      }
    });

    const voiceover = await generateVoiceover(script.script, project.voice);
    const voiceoverPath = storagePath("drama/voiceovers", `${safeFileName(updatedProject.title)}-${project.id.slice(0, 8)}.mp3`);
    await writeFile(voiceoverPath, voiceover);
    const characterBible = await generateDramaCharacterBible(updatedProject, script.script);
    const projectWithVoice = await prisma.dramaShortProject.update({
      where: { id: project.id },
      data: {
        voiceoverPath,
        characterBibleJson: JSON.stringify(characterBible)
      }
    });

    const storyboard = await generateDramaStoryboard(projectWithVoice);
    await prisma.dramaShortScene.deleteMany({ where: { dramaShortProjectId: project.id } });
    const scenes = await prisma.$transaction(
      storyboard.scenes.map((scene) =>
        prisma.dramaShortScene.create({
          data: {
            dramaShortProjectId: project.id,
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
    await prisma.dramaShortProject.update({ where: { id: project.id }, data: { storyboardJson: JSON.stringify(storyboard) } });

    for (const scene of scenes) {
      const rendered = await renderDramaScene(scene.id);
      if (rendered.status === "failed") throw new Error(rendered.errorMessage || `Drama scene ${rendered.sceneNumber} failed.`);
    }

    return renderDramaFinalVideo(project.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return prisma.dramaShortProject.update({ where: { id: project.id }, data: { status: "failed", errorMessage: message } });
  }
}
