import { writeFile } from "node:fs/promises";
import OpenAI from "openai";
import { renderVerticalVideo } from "@/lib/ffmpeg";
import { safeFileName, storagePath } from "@/lib/storage";

type KidsImageScene = {
  id: string;
  sceneNumber: number;
  narration: string;
  prompt: string;
  visualDescription?: string | null;
  duration: number;
  voiceoverPath?: string | null;
};

type KidsImageProject = {
  id: string;
  title: string;
  artStyle: string;
  ageRange: string;
  aspectRatio?: string | null;
};

function client() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Add it to .env.local and restart the dev server.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function imageModel() {
  return process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5";
}

function imagePrompt(scene: KidsImageScene, project: KidsImageProject) {
  const aspectRatio = project.aspectRatio === "9:16" ? "9:16" : "16:9";
  const orientation = aspectRatio === "9:16" ? "vertical portrait" : "landscape";
  return `Create one ${orientation} storyboard frame for a YouTube Kids story.

Story: ${project.title}
Audience age range: ${project.ageRange}
Visual style: ${project.artStyle}
Scene ${scene.sceneNumber}: ${scene.visualDescription || scene.prompt}
Narration context: ${scene.narration}

Requirements:
- ${aspectRatio} ${orientation} composition
- child-safe, warm, colorful, gentle
- consistent storybook animation look
- no visible text, no signs, no labels, no subtitles, no captions, no logos, no watermarks
- do not show written words anywhere in the image`;
}

async function downloadImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`OpenAI image download failed: ${response.status} ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function generateKidsStoryboardImage(scene: KidsImageScene, project: KidsImageProject) {
  const aspectRatio = project.aspectRatio === "9:16" ? "9:16" : "16:9";
  const openai = client();
  const response = await openai.images.generate({
    model: imageModel(),
    prompt: imagePrompt(scene, project),
    size: aspectRatio === "9:16" ? "1024x1536" : "1536x1024",
    quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
    n: 1
  } as any);
  const image = response.data?.[0];
  const bytes = image?.b64_json ? Buffer.from(image.b64_json, "base64") : image?.url ? await downloadImage(image.url) : null;
  if (!bytes) throw new Error("OpenAI did not return image data for the storyboard frame.");

  const imagePath = storagePath("kids/images", `${scene.sceneNumber}-${safeFileName(project.title)}-${scene.id}.png`);
  await writeFile(imagePath, bytes);
  return imagePath;
}

export async function renderKidsImageClip(scene: KidsImageScene, project: KidsImageProject, imagePath: string) {
  const aspectRatio = project.aspectRatio === "9:16" ? "9:16" : "16:9";
  const outputPath = storagePath("kids/scenes", `${scene.sceneNumber}-${scene.id}-openai-image.mp4`);
  await renderVerticalVideo({
    backgroundPath: imagePath,
    voiceoverPath: scene.voiceoverPath,
    outputPath,
    durationSeconds: scene.duration,
    effects: ["Zoom motion"],
    aspectRatio
  });
  return outputPath;
}
