import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { prisma } from "../prisma";
import { generateVoiceover } from "../openai";
import { createAssFile, createSrtFile, splitScriptIntoCaptionChunks } from "../captions";
import { getMediaDuration, renderFinalStoryVideo } from "../ffmpeg";
import { getVideoProvider } from "../providers";
import { checkSceneQuality } from "../scene-quality";
import { ensureStorage, safeFileName, storagePath } from "../storage";
import { buildCreatorProfile } from "./creator-profile";
import { buildProductProfile } from "./product-profile";
import { generateUGCScript } from "./script-generator";
import { generateUGCStoryboard } from "./storyboard";
import { buildUGCScenePrompt } from "./prompt-builder";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ugcDurationToSeconds(duration: string) {
  const match = duration.match(/\d+/);
  return match ? Number(match[0]) : 30;
}

async function writeUGCCaptions(projectId: string, script: string, durationSeconds: number) {
  const chunks = splitScriptIntoCaptionChunks(script, durationSeconds);
  const assPath = storagePath("ugc/captions", `${projectId}.ass`);
  const srtPath = storagePath("ugc/captions", `${projectId}.srt`);
  await Promise.all([writeFile(assPath, createAssFile(chunks, "Bold Stroke")), writeFile(srtPath, createSrtFile(chunks))]);
  return assPath;
}

async function sampleImage(bucket: "ugc/products" | "ugc/creators", fileName: string, colors: [string, string], label: string) {
  const target = storagePath(bucket, fileName);
  if (existsSync(target)) return target;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
  <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs>
  <rect width="1080" height="1920" fill="url(#g)"/>
  <circle cx="540" cy="720" r="210" fill="rgba(255,255,255,.24)"/>
  <rect x="310" y="1000" width="460" height="520" rx="80" fill="rgba(255,255,255,.32)"/>
  <text x="540" y="1650" text-anchor="middle" font-family="Arial" font-size="72" font-weight="900" fill="white">${label}</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(target);
  return target;
}

export async function createSampleUGCProject() {
  await ensureStorage();
  const productPath = await sampleImage("ugc/products", "sample-glow-serum.png", ["#f7b7d2", "#6d00ff"], "Glow Serum");
  const creatorPath = await sampleImage("ugc/creators", "sample-creator.png", ["#8fd3f4", "#fbc2eb"], "Creator");
  const project = await prisma.uGCProject.create({
    data: {
      title: "Glow Serum Sample UGC",
      productName: "GlowDrop Hydration Serum",
      productCategory: "Skincare",
      productDescription: "A lightweight serum for hydrated, dewy-looking skin.",
      productBenefits: "Hydration, glow, smoother-looking skin, easy daily routine",
      offerText: "Intro offer available this week",
      ctaText: "Shop GlowDrop today",
      targetAudience: "busy skincare shoppers who want a simple glow routine",
      tone: "relatable",
      creatorVibe: "relatable",
      creatorAgeRange: "25-34",
      style: "Selfie Review",
      duration: "15 sec",
      platform: "TikTok",
      voice: "Nova - energetic female",
      videoProvider: "veo3",
      captionsEnabled: true,
      musicEnabled: false,
      brief: "Create a quick authentic skincare UGC ad with a creator holding the serum, trying it, reacting, and ending with a shop now CTA.",
      assets: {
        create: [
          { type: "product-image", filePath: productPath, originalFileName: "sample-glow-serum.png" },
          { type: "creator-image", filePath: creatorPath, originalFileName: "sample-creator.png" }
        ]
      }
    }
  });
  return generateUGCVideo(project.id);
}

export async function renderUGCScene(sceneId: string) {
  const scene = await prisma.uGCScene.findUnique({ where: { id: sceneId }, include: { ugcProject: { include: { assets: true } } } });
  if (!scene) throw new Error("UGC scene not found.");
  const provider = getVideoProvider(scene.ugcProject.videoProvider);
  const prompt = buildUGCScenePrompt(scene, scene.ugcProject);
  const creatorImage = scene.ugcProject.assets.find((asset) => asset.type === "creator-image")?.filePath;
  const productImage = scene.ugcProject.assets.find((asset) => asset.type === "product-image")?.filePath;
  const lowerShot = `${scene.shotType || ""} ${scene.visualDescription || ""}`.toLowerCase();
  const referenceImage = lowerShot.includes("product") || lowerShot.includes("close-up") ? productImage || creatorImage : creatorImage || productImage;
  const settings = provider.name.startsWith("local-comfyui") ? await prisma.settings.findFirst() : null;
  const localWorkflowType = settings?.comfyWorkflowType || "text-to-video";
  const maxAttempts = 3;
  let lastError = "";

  await prisma.uGCScene.update({ where: { id: scene.id }, data: { status: scene.clipPath ? "regenerating" : "generating", approved: false, errorMessage: null } });
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      if (attempt > 0) {
        await prisma.uGCScene.update({ where: { id: scene.id }, data: { retryCount: { increment: 1 }, status: "regenerating" } });
      }
      const job = await provider.generateSceneClip({
        prompt,
        duration: scene.duration,
        aspectRatio: "9:16",
        style: scene.ugcProject.style,
        referenceImages: localWorkflowType === "image-to-video" && referenceImage ? [referenceImage] : [],
        mode: provider.name.startsWith("local-comfyui") ? (localWorkflowType as "text-to-video" | "image-to-video" | "custom-workflow") : undefined,
        projectType: "ugc",
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        narration: scene.narration
      });
      let status = await provider.getSceneClipStatus(job.jobId);
      const maxPolls = provider.name === "mock" ? 1 : 42;
      for (let poll = 0; status.status === "generating" && poll < maxPolls; poll += 1) {
        await wait(10_000);
        status = await provider.getSceneClipStatus(job.jobId);
        await prisma.uGCScene.update({ where: { id: scene.id }, data: { status: status.status, provider: provider.name, providerJobId: job.jobId, errorMessage: status.errorMessage || null } });
      }
      if (status.status !== "ready") throw new Error(status.errorMessage || "Veo UGC scene generation did not complete in time.");

      const outputPath = provider.name.startsWith("local-comfyui")
        ? storagePath("scenes/local-wan", `${scene.id}.mp4`)
        : storagePath("ugc/scenes", `${scene.sceneNumber}-${scene.id}-${provider.name}.mp4`);
      const clipPath = await provider.downloadSceneClip(job.jobId, outputPath);
      const quality = await checkSceneQuality(clipPath, scene.duration);
      if (!quality.ok) throw new Error(`Scene quality check failed: ${quality.errors.join(" ")}`);

      return prisma.uGCScene.update({
        where: { id: scene.id },
        data: { status: "ready", provider: provider.name, providerJobId: job.jobId, clipPath, prompt, errorMessage: null }
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < maxAttempts - 1) await wait(1500);
    }
  }

  return prisma.uGCScene.update({ where: { id: scene.id }, data: { status: "failed", errorMessage: lastError } });
}

export async function renderUGCFinalVideo(projectId: string) {
  const project = await prisma.uGCProject.findUnique({
    where: { id: projectId },
    include: { scenes: { orderBy: { sceneNumber: "asc" } } }
  });
  if (!project) throw new Error("UGC project not found.");
  const usable = project.scenes.filter((scene) => (scene.approved || ["approved", "ready"].includes(scene.status)) && scene.clipPath && existsSync(scene.clipPath));
  if (!usable.length) throw new Error("No ready UGC scenes are available to render.");
  const settings = await prisma.settings.findFirst();
  const outputPath = project.finalVideoPath || storagePath("ugc/exports", `${safeFileName(project.title)}-${project.id.slice(0, 8)}.mp4`);
  const duration = Math.ceil((await getMediaDuration(project.voiceoverPath || "")) || ugcDurationToSeconds(project.duration));

  await renderFinalStoryVideo({
    scenePaths: usable.map((scene) => scene.clipPath as string),
    voiceoverPath: project.voiceoverPath,
    musicPath: null,
    captionsPath: project.captionsEnabled ? project.captionsPath : null,
    outputPath,
    duration,
    transitionStyle: "hard cut",
    watermarkPath: settings?.watermarkEnabled ? settings.watermarkPath : null,
    watermarkPosition: settings?.watermarkPosition,
    watermarkOpacity: settings?.watermarkOpacity ?? undefined
  });

  return prisma.uGCProject.update({ where: { id: project.id }, data: { status: "rendered", finalVideoPath: outputPath, errorMessage: null } });
}

export async function generateUGCVideo(projectId: string) {
  await ensureStorage();
  const project = await prisma.uGCProject.findUnique({ where: { id: projectId }, include: { assets: true } });
  if (!project) throw new Error("UGC project not found.");
  const productImage = project.assets.find((asset) => asset.type === "product-image")?.filePath;
  const creatorImage = project.assets.find((asset) => asset.type === "creator-image")?.filePath;

  try {
    await prisma.uGCProject.update({ where: { id: project.id }, data: { status: "generating", errorMessage: null } });
    const productProfile = await buildProductProfile(productImage, project);
    const creatorProfile = await buildCreatorProfile(creatorImage, {
      creatorName: project.creatorName,
      creatorVibe: project.creatorVibe || project.tone,
      creatorGender: project.creatorGender,
      creatorAgeRange: project.creatorAgeRange
    });
    const script = await generateUGCScript(project);
    const enrichedProject = await prisma.uGCProject.update({
      where: { id: project.id },
      data: {
        title: script.title || project.title,
        hook: script.hook,
        script: script.script,
        productProfileJson: JSON.stringify(productProfile),
        creatorProfileJson: JSON.stringify(creatorProfile)
      }
    });
    const duration = ugcDurationToSeconds(project.duration);
    const voiceover = await generateVoiceover(script.script, project.voice);
    const voiceoverPath = storagePath("ugc/voiceovers", `${safeFileName(enrichedProject.title)}-${project.id.slice(0, 8)}.mp3`);
    await writeFile(voiceoverPath, voiceover);
    const voiceDuration = await getMediaDuration(voiceoverPath);
    const captionPath = project.captionsEnabled ? await writeUGCCaptions(project.id, script.script, Math.ceil((voiceDuration ?? duration) + 0.25)) : null;
    const projectWithMedia = await prisma.uGCProject.update({
      where: { id: project.id },
      data: { voiceoverPath, captionsPath: captionPath }
    });
    const storyboard = await generateUGCStoryboard(projectWithMedia);

    await prisma.uGCScene.deleteMany({ where: { ugcProjectId: project.id } });
    const scenes = await prisma.$transaction(
      storyboard.scenes.map((scene) =>
        prisma.uGCScene.create({
          data: {
            ugcProjectId: project.id,
            sceneNumber: scene.sceneNumber,
            narration: scene.narration,
            prompt: scene.prompt,
            visualDescription: scene.visualDescription,
            shotType: scene.shotType,
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
    await prisma.uGCProject.update({ where: { id: project.id }, data: { storyboardJson: JSON.stringify(storyboard) } });

    for (const scene of scenes) {
      const rendered = await renderUGCScene(scene.id);
      if (rendered.status === "failed") throw new Error(rendered.errorMessage || `UGC scene ${rendered.sceneNumber} failed.`);
    }

    return renderUGCFinalVideo(project.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return prisma.uGCProject.update({ where: { id: project.id }, data: { status: "failed", errorMessage: message } });
  }
}
