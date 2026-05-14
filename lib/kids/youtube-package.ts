import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import OpenAI from "openai";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { safeFileName, storagePath } from "@/lib/storage";

type KidsPackage = {
  description: string;
  tags: string[];
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

async function downloadImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`OpenAI image download failed: ${response.status} ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
}

function parseTags(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 18);
  if (typeof value === "string") {
    return value
      .split(/[,#\n]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 18);
  }
  return [];
}

async function generateMetadata(input: {
  title: string;
  script?: string | null;
  moral?: string | null;
  ageRange: string;
  storyTheme?: string | null;
}) {
  const openai = client();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Create YouTube metadata for original child-safe story videos. Return strict JSON with description and tags. Keep it parent-friendly, non-clickbait, and safe for kids."
      },
      {
        role: "user",
        content: `Title: ${input.title}
Age range: ${input.ageRange}
Theme: ${input.storyTheme || "gentle adventure"}
Moral: ${input.moral || "positive lesson"}
Script:
${(input.script || "").slice(0, 8000)}

Return JSON:
{
  "description": "2 short friendly paragraphs plus a simple parent-friendly call to action. Do not mention AI.",
  "tags": ["12 to 18 YouTube tags, no hashtag symbols"]
}`
      }
    ]
  });

  const raw = response.choices[0]?.message.content;
  if (!raw) throw new Error("OpenAI returned an empty YouTube metadata response.");
  const parsed = JSON.parse(raw) as Partial<KidsPackage>;
  return {
    description: String(parsed.description || "").trim(),
    tags: parseTags(parsed.tags)
  };
}

function kidsAspectRatio(value?: string | null) {
  return value === "9:16" ? "9:16" : "16:9";
}

function thumbnailPrompt(title: string, ageRange: string, artStyle: string, aspectRatio?: string | null) {
  const ratio = kidsAspectRatio(aspectRatio);
  const composition = ratio === "9:16" ? "9:16 vertical YouTube Shorts thumbnail composition" : "16:9 YouTube thumbnail composition";
  const layout =
    ratio === "9:16"
      ? `- place the exact title text at the very top, fully inside the frame, centered, with generous safe margins
- keep the title inside the top 28% of the image
- place the main characters at the bottom, fully visible from head to toe when possible
- leave clear separation between the title and the characters so nothing overlaps or gets cropped`
      : `- place the exact title text in the upper third, fully inside the frame, with generous safe margins
- place the main characters in the lower half, large and fully visible
- leave clear separation between the title and the characters so nothing overlaps or gets cropped`;
  return `Create a bright, colorful, eye-catching YouTube thumbnail for a kids story video.

Use the provided reference image as the main character/style reference. Make the character large, expressive, happy, and clearly visible.

Thumbnail title text: "${title}"

Requirements:
- ${composition}
- bold readable title text using the exact title above
- all words must be fully visible, spelled correctly, and not cropped by any edge
${layout}
- bright colorful background with playful storybook energy
- child-safe, warm, friendly, magical, exciting but not scary
- no logos, no watermarks, no unrelated brand names
- visual style: ${artStyle}
- suitable for ages ${ageRange}`;
}

async function optimizeThumbnail(bytes: Buffer, aspectRatio: string) {
  const size = aspectRatio === "9:16" ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
  for (const quality of [88, 82, 76, 70, 64, 58]) {
    const output = await sharp(bytes)
      .resize(size.width, size.height, { fit: "cover", position: "center" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (output.length <= 1_950_000 || quality === 58) return output;
  }
  return sharp(bytes)
    .resize(Math.round(size.width * 0.85), Math.round(size.height * 0.85), { fit: "cover", position: "center" })
    .jpeg({ quality: 56, mozjpeg: true })
    .toBuffer();
}

async function generateThumbnail(input: {
  id: string;
  title: string;
  ageRange: string;
  artStyle: string;
  aspectRatio?: string | null;
  referenceImagePath?: string | null;
}) {
  const openai = client();
  const aspectRatio = kidsAspectRatio(input.aspectRatio);
  const imageSize = aspectRatio === "9:16" ? "1024x1536" : "1536x1024";
  const prompt = thumbnailPrompt(input.title, input.ageRange, input.artStyle, aspectRatio);
  let response;

  if (input.referenceImagePath && existsSync(input.referenceImagePath)) {
    try {
      response = await openai.images.edit({
        model: imageModel(),
        image: createReadStream(input.referenceImagePath),
        prompt,
        size: imageSize,
        quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
        n: 1
      } as any);
    } catch {
      response = null;
    }
  }

  response ??= await openai.images.generate({
    model: imageModel(),
    prompt,
    size: imageSize,
    quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
    n: 1
  } as any);

  const image = response.data?.[0];
  const bytes = image?.b64_json ? Buffer.from(image.b64_json, "base64") : image?.url ? await downloadImage(image.url) : null;
  if (!bytes) throw new Error("OpenAI did not return image data for the YouTube thumbnail.");

  const optimizedBytes = await optimizeThumbnail(bytes, aspectRatio);
  const thumbnailPath = storagePath("kids/thumbnails", `${safeFileName(input.title)}-${input.id.slice(0, 8)}-${aspectRatio.replace(":", "x")}-thumbnail.jpg`);
  await writeFile(thumbnailPath, optimizedBytes);
  return thumbnailPath;
}

export async function generateKidsYoutubePackage(projectId: string) {
  const project = await prisma.kidsStoryProject.findUnique({
    where: { id: projectId },
    include: {
      assets: true,
      scenes: { orderBy: { sceneNumber: "asc" } }
    }
  });
  if (!project) throw new Error("Kids story project not found.");

  const metadata = await generateMetadata({
    title: project.title,
    script: project.script,
    moral: project.moral,
    ageRange: project.ageRange,
    storyTheme: project.storyTheme
  });
  const referenceImagePath =
    project.scenes.find((scene) => scene.imagePath && existsSync(scene.imagePath))?.imagePath ||
    project.assets.find((asset) => asset.type === "character-reference" && existsSync(asset.filePath))?.filePath ||
    null;
	  const thumbnailPath = await generateThumbnail({
	    id: project.id,
    title: project.title,
    ageRange: project.ageRange,
    artStyle: project.artStyle,
    aspectRatio: project.aspectRatio,
    referenceImagePath
  });

  return prisma.kidsStoryProject.update({
    where: { id: project.id },
    data: {
      youtubeDescription: metadata.description,
      youtubeTags: metadata.tags.join(", "),
      thumbnailPath,
      errorMessage: null
    }
  });
}
