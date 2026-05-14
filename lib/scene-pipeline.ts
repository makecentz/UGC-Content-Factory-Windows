import { existsSync } from "node:fs";
import { prisma } from "./prisma";
import { generateStoryboard, saveStoryboard } from "./storyboard";
import { getVideoProvider } from "./providers";
import { renderFinalStoryVideo } from "./ffmpeg";
import { storagePath } from "./storage";
import { generateCharacterBible, characterBiblePrompt } from "./character-bible";
import { getStyleLock, styleLockPrompt } from "./style-locks";
import { sanitizePrompt } from "./prompt-sanitizer";
import { checkSceneQuality } from "./scene-quality";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createScenesFromStoryboard(videoId: string, durationSeconds: number) {
  const video = await prisma.video.findUnique({ where: { id: videoId }, include: { series: true } });
  if (!video) throw new Error("Video not found.");
  const storyboard = await generateStoryboard(video.series, video.script, durationSeconds);
  const characterBible = await generateCharacterBible(video.script, video.series.customNiche || video.series.niche, video.series.artStyle);
  const styleLock = getStyleLock(video.series.artStyle);
  await saveStoryboard(video.id, storyboard);

  await prisma.scene.deleteMany({ where: { videoId } });
  await prisma.video.update({
    where: { id: videoId },
    data: {
      storyboardJson: JSON.stringify(storyboard),
      characterBibleJson: JSON.stringify(characterBible),
      styleLockJson: JSON.stringify(styleLock),
      renderLogsJson: JSON.stringify([`Storyboard created with ${storyboard.scenes.length} scenes.`])
    }
  });

  return prisma.$transaction(
    storyboard.scenes.map((scene) =>
      prisma.scene.create({
        data: {
          videoId,
          sceneNumber: scene.sceneNumber,
          narration: scene.narration,
          prompt: sanitizePrompt(`${scene.prompt}\n\n${characterBiblePrompt(characterBible)}\n\n${styleLockPrompt(styleLock)}`),
          visualDescription: scene.visualDescription,
          camera: scene.camera,
          mood: scene.mood,
          duration: scene.duration,
          startTime: scene.startTime,
          endTime: scene.endTime,
          provider: video.series.videoProvider,
          status: "pending"
        }
      })
    )
  );
}

export async function renderOrRequestScene(sceneId: string) {
  const scene = await prisma.scene.findUnique({ where: { id: sceneId }, include: { video: { include: { series: true } } } });
  if (!scene) throw new Error("Scene not found.");
  const provider = getVideoProvider(scene.video.series.videoProvider);

  const characterBible = scene.video.characterBibleJson ? JSON.parse(scene.video.characterBibleJson) : null;
  const styleLock = scene.video.styleLockJson ? JSON.parse(scene.video.styleLockJson) : getStyleLock(scene.video.series.artStyle);
  const selectedPrompt = sanitizePrompt(`${scene.editedPrompt || scene.prompt}\n\n${characterBiblePrompt(characterBible)}\n\n${styleLockPrompt(styleLock)}`);

  await prisma.scene.update({ where: { id: scene.id }, data: { status: "generating", provider: provider.name, errorMessage: null } });

  const maxAttempts = 3;
  let lastError = "";
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await prisma.scene.update({
        where: { id: scene.id },
        data: {
          retryCount: { increment: attempt === 0 ? 0 : 1 },
          lastRetryAt: attempt === 0 ? scene.lastRetryAt : new Date(),
          status: attempt === 0 ? "generating" : "regenerating"
        }
      });

      const job = await provider.generateSceneClip({
        prompt: selectedPrompt,
        duration: scene.duration,
        aspectRatio: "9:16",
        style: scene.video.series.artStyle,
        mode: provider.name.startsWith("local-comfyui") ? "text-to-video" : undefined,
        projectType: "story",
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        narration: scene.narration
      });
      let status = await provider.getSceneClipStatus(job.jobId);
      const maxPolls = provider.name === "mock" ? 1 : 42;
      for (let poll = 0; status.status === "generating" && poll < maxPolls; poll += 1) {
        await wait(10_000);
        status = await provider.getSceneClipStatus(job.jobId);
        await prisma.scene.update({
          where: { id: scene.id },
          data: {
            status: status.status,
            providerJobId: job.jobId,
            errorMessage: status.errorMessage || null
          }
        });
      }

      if (status.status !== "ready") {
        throw new Error(status.errorMessage || `${provider.name} scene generation did not complete in time.`);
      }

      const outputPath = provider.name.startsWith("local-comfyui")
        ? storagePath("scenes/local-wan", `${scene.id}.mp4`)
        : storagePath("scenes", `${scene.sceneNumber}-${scene.id}-${provider.name}.mp4`);
      const clipPath = await provider.downloadSceneClip(job.jobId, outputPath);
      const quality = await checkSceneQuality(clipPath, scene.duration);
      if (!quality.ok) throw new Error(`Scene quality check failed: ${quality.errors.join(" ")}`);

      return prisma.scene.update({
        where: { id: scene.id },
        data: {
          status: "ready",
          provider: provider.name,
          providerJobId: job.jobId,
          clipPath,
          prompt: selectedPrompt,
          qualityReportJson: JSON.stringify(quality),
          errorMessage: null
        }
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < maxAttempts - 1) await wait(1500);
    }
  }

  return prisma.scene.update({
    where: { id: scene.id },
    data: {
      status: "failed",
      errorMessage: lastError
    }
  });
}

export async function pollSceneJobs(videoId: string) {
  return prisma.scene.findMany({ where: { videoId }, orderBy: { sceneNumber: "asc" } });
}

export async function stitchSceneClips(videoId: string) {
  const video = await prisma.video.findUnique({ where: { id: videoId }, include: { series: true, scenes: { orderBy: { sceneNumber: "asc" } } } });
  if (!video) throw new Error("Video not found.");
  const usableScenes = video.scenes.filter((scene) => ["approved", "ready"].includes(scene.status) || scene.approved);
  const scenePaths = usableScenes.map((scene) => scene.clipPath).filter((clipPath): clipPath is string => Boolean(clipPath && existsSync(clipPath)));
  if (!scenePaths.length) throw new Error("No completed scene clips are ready to stitch.");
  if (scenePaths.length !== usableScenes.length) throw new Error("Some selected scene clips are missing.");

  const settings = await prisma.settings.findFirst();
  await prisma.video.update({
    where: { id: videoId },
    data: {
      finalRenderStatus: "rendering",
      renderLogsJson: JSON.stringify([...(video.renderLogsJson ? JSON.parse(video.renderLogsJson) : []), `Final render started with ${scenePaths.length} scene clips.`])
    }
  });

  await renderFinalStoryVideo({
    scenePaths,
    voiceoverPath: video.voiceoverPath,
    musicPath: video.musicPath,
    captionsPath: video.captionsPath,
    outputPath: video.finalVideoPath || "",
    duration: video.voiceoverPath ? Math.ceil((video.scenes.at(-1)?.endTime ?? 30) + 0.25) : 30,
    transitionStyle: video.series.transitionStyle,
    watermarkPath: settings?.watermarkEnabled ? settings.watermarkPath : null,
    watermarkPosition: settings?.watermarkPosition,
    watermarkOpacity: settings?.watermarkOpacity ?? undefined
  });

  return prisma.video.update({
    where: { id: videoId },
    data: {
      status: "ready",
      finalRenderStatus: "ready",
      renderLogsJson: JSON.stringify([...(video.renderLogsJson ? JSON.parse(video.renderLogsJson) : []), "Final render completed."])
    }
  });
}

export async function generateStoryVideo(videoId: string, durationSeconds: number) {
  const scenes = await createScenesFromStoryboard(videoId, durationSeconds);
  for (const scene of scenes) {
    const rendered = await renderOrRequestScene(scene.id);
    if (rendered.status === "failed") {
      throw new Error(rendered.errorMessage || `Scene ${rendered.sceneNumber} failed.`);
    }
  }
  await pollSceneJobs(videoId);
  return stitchSceneClips(videoId);
}
