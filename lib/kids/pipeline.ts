import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { concatVideoFiles, getMediaDuration, renderTitleCardClip } from "@/lib/ffmpeg";
import { logError, logInfo } from "@/lib/logger";
import { ensureStorage, safeFileName, storagePath } from "@/lib/storage";
import { generateKidsStoryboardImage, renderKidsImageClip } from "./image-storyboard";
import { generateKidsStoryPlan } from "./script-generator";
import { transcribeYouTubeUrl } from "./youtube";
import { generateKidsVoiceover } from "./voice";

type KidsAspectRatio = "9:16" | "16:9";

function kidsAspectRatio(value?: string | null): KidsAspectRatio {
  return value === "9:16" ? "9:16" : "16:9";
}

function buildScenePrompt(scene: { prompt: string; visualDescription?: string | null; camera?: string | null; mood?: string | null }, artStyle: string, aspectRatio?: string | null) {
  const ratio = kidsAspectRatio(aspectRatio);
  const composition = ratio === "9:16" ? "Vertical 9:16 YouTube Shorts kids story animation." : "Landscape 16:9 YouTube kids story animation.";
  return [
    scene.prompt,
    scene.visualDescription,
    `Style: ${artStyle}.`,
    scene.camera ? `Camera: ${scene.camera}.` : "",
    scene.mood ? `Mood: ${scene.mood}.` : "",
    `${composition} No visible text, no captions, no subtitles, no logos, no words on screen. Gentle child-safe imagery.`
  ]
    .filter(Boolean)
    .join("\n");
}

async function optionalYouTubeTranscript(project: { youtubeUrl?: string | null; sourceTranscript?: string | null; prompt?: string | null; id: string }) {
  if (project.sourceTranscript) return project.sourceTranscript;
  if (!project.youtubeUrl) return null;

  try {
    return await transcribeYouTubeUrl(project.youtubeUrl, project.id);
  } catch (error) {
    if (project.prompt?.trim()) return null;
    throw error;
  }
}

async function ensureSceneVoiceover(scene: {
  id: string;
  sceneNumber: number;
  narration: string;
  voiceoverPath?: string | null;
  kidsStoryProject: { id: string; title: string; voiceProvider: string; voice: string };
}) {
  if (scene.voiceoverPath && existsSync(scene.voiceoverPath)) {
    const existingDuration = await getMediaDuration(scene.voiceoverPath);
    return { voiceoverPath: scene.voiceoverPath, duration: Math.max(1, Math.ceil((existingDuration || 1) + 0.25)) };
  }

  const voiceover = await generateKidsVoiceover(scene.narration, scene.kidsStoryProject.voiceProvider, scene.kidsStoryProject.voice);
  const voiceoverPath = storagePath(
    "kids/voiceovers",
    `${safeFileName(scene.kidsStoryProject.title)}-${scene.kidsStoryProject.id.slice(0, 8)}-scene-${scene.sceneNumber}-${scene.id}.mp3`
  );
  await writeFile(voiceoverPath, voiceover);
  const duration = await getMediaDuration(voiceoverPath);
  return { voiceoverPath, duration: Math.max(1, Math.ceil((duration || 1) + 0.25)) };
}

export async function renderKidsStoryScene(sceneId: string) {
  const scene = await prisma.kidsStoryScene.findUnique({ where: { id: sceneId }, include: { kidsStoryProject: { include: { assets: true } } } });
  if (!scene) throw new Error("Kids story scene not found.");
  const project = scene.kidsStoryProject;
  const aspectRatio = kidsAspectRatio(project.aspectRatio);
  const prompt = scene.editedPrompt || buildScenePrompt(scene, project.artStyle, aspectRatio);

  await prisma.kidsStoryScene.update({ where: { id: scene.id }, data: { status: scene.clipPath ? "regenerating" : "generating", approved: false, errorMessage: null } });
  try {
    await logInfo("Kids story scene render started", { sceneId, projectId: project.id, sceneNumber: scene.sceneNumber });
    const { voiceoverPath, duration } = await ensureSceneVoiceover(scene);
    const imagePath =
      scene.imagePath && existsSync(scene.imagePath)
        ? scene.imagePath
        : await generateKidsStoryboardImage(
            {
              id: scene.id,
              sceneNumber: scene.sceneNumber,
              narration: scene.narration,
              prompt,
              visualDescription: scene.visualDescription,
              duration
            },
            {
              id: project.id,
              title: project.title,
              artStyle: project.artStyle,
              ageRange: project.ageRange,
              aspectRatio
            }
          );
    const clipPath = await renderKidsImageClip(
      {
        id: scene.id,
        sceneNumber: scene.sceneNumber,
        narration: scene.narration,
        prompt,
        visualDescription: scene.visualDescription,
        duration,
        voiceoverPath
      },
      {
        id: project.id,
        title: project.title,
        artStyle: project.artStyle,
        ageRange: project.ageRange,
        aspectRatio
      },
      imagePath
    );
    const updatedScene = await prisma.kidsStoryScene.update({
      where: { id: scene.id },
      data: { status: "ready", approved: true, provider: "openai-image", providerJobId: null, imagePath, voiceoverPath, clipPath, duration, prompt, errorMessage: null }
    });
    await logInfo("Kids story scene render completed", { sceneId, projectId: project.id, sceneNumber: scene.sceneNumber, clipPath });
    return updatedScene;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logError("Kids story scene render failed", error, { sceneId, projectId: project.id, sceneNumber: scene.sceneNumber });
    return prisma.kidsStoryScene.update({ where: { id: scene.id }, data: { status: "failed", errorMessage: message, retryCount: { increment: 1 } } });
  }
}

export async function renderKidsStoryFinal(projectId: string) {
  await ensureStorage();
  await logInfo("Kids final render started", { projectId });
  const project = await prisma.kidsStoryProject.findUnique({ where: { id: projectId }, include: { scenes: { orderBy: { sceneNumber: "asc" } } } });
  if (!project) throw new Error("Kids story project not found.");
  const aspectRatio = kidsAspectRatio(project.aspectRatio);
  const sceneInputs = project.scenes.filter((scene) => scene.approved || scene.status === "ready");
  const readyScenes = [];
  for (const scene of sceneInputs) {
    if (!scene.clipPath || !existsSync(scene.clipPath) || !scene.voiceoverPath || !existsSync(scene.voiceoverPath)) {
      readyScenes.push(await renderKidsStoryScene(scene.id));
    } else {
      readyScenes.push(scene);
    }
  }
  const usable = readyScenes.filter((scene) => scene.clipPath && existsSync(scene.clipPath));
  if (!usable.length) throw new Error("No ready kids story scenes are available to render.");
  const outputPath = project.finalVideoPath || storagePath("kids/exports", `${safeFileName(project.title)}-${project.id.slice(0, 8)}.mp4`);

  const introPath = project.introVideoPath && existsSync(project.introVideoPath) ? project.introVideoPath : null;
  const outroPath = project.outroVideoPath && existsSync(project.outroVideoPath) ? project.outroVideoPath : null;
  const renderStamp = Date.now();
  const titleCardOutputPath = storagePath("temp", `kids-title-card-${project.id}-${renderStamp}.mp4`);
  let titleCardPath: string | null = null;

  try {
    titleCardPath = await renderTitleCardClip(project.title, titleCardOutputPath, aspectRatio);
  } catch (error) {
    await logError("Kids title card render skipped", error, { projectId: project.id, titleCardOutputPath });
  }

  await concatVideoFiles([introPath, titleCardPath, ...usable.map((scene) => scene.clipPath as string), outroPath].filter((clip): clip is string => Boolean(clip)), outputPath, aspectRatio);

  const renderedProject = await prisma.kidsStoryProject.update({ where: { id: project.id }, data: { status: "rendered", finalVideoPath: outputPath, errorMessage: null } });
  await logInfo("Kids final render completed", { projectId: project.id, outputPath, sceneCount: usable.length, hasIntro: Boolean(introPath), hasOutro: Boolean(outroPath) });
  return renderedProject;
}

export async function generateKidsStory(projectId: string) {
  await ensureStorage();
  await logInfo("Kids story generation started", { projectId });
  const project = await prisma.kidsStoryProject.findUnique({ where: { id: projectId }, include: { assets: true } });
  if (!project) throw new Error("Kids story project not found.");

  try {
    await prisma.kidsStoryProject.update({ where: { id: project.id }, data: { status: "generating", errorMessage: null } });
    const sourceTranscript = await optionalYouTubeTranscript(project);
    const plan = await generateKidsStoryPlan({
      prompt: project.prompt,
      sourceTranscript,
      ageRange: project.ageRange,
      storyTheme: project.storyTheme,
      moral: project.moral,
      artStyle: project.artStyle,
      duration: project.duration,
      aspectRatio: project.aspectRatio
    });
    await prisma.kidsStoryProject.update({
      where: { id: project.id },
      data: { title: plan.title || project.title, moral: plan.moral, script: plan.script, sourceTranscript, storyboardJson: JSON.stringify(plan), voiceoverPath: null }
    });
    await prisma.kidsStoryScene.deleteMany({ where: { kidsStoryProjectId: project.id } });
    const scenes = await prisma.$transaction(
      plan.scenes.map((scene) =>
        prisma.kidsStoryScene.create({
          data: {
            kidsStoryProjectId: project.id,
            sceneNumber: scene.sceneNumber,
            narration: scene.narration,
            prompt: buildScenePrompt(scene, project.artStyle, project.aspectRatio),
            visualDescription: scene.visualDescription,
            camera: scene.camera,
            mood: scene.mood,
            duration: scene.duration,
            startTime: scene.startTime,
            endTime: scene.endTime,
            provider: "openai-image"
          }
        })
      )
    );

    for (const scene of scenes) {
      const rendered = await renderKidsStoryScene(scene.id);
      if (rendered.status === "failed") throw new Error(rendered.errorMessage || `Kids story scene ${rendered.sceneNumber} failed.`);
    }

    const renderedProject = await renderKidsStoryFinal(project.id);
    await logInfo("Kids story generation completed", { projectId: project.id, status: renderedProject.status });
    return renderedProject;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logError("Kids story generation failed", error, { projectId: project.id });
    return prisma.kidsStoryProject.update({ where: { id: project.id }, data: { status: "failed", errorMessage: message } });
  }
}
