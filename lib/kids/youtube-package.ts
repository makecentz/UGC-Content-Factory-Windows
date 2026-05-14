import { writeFile } from "node:fs/promises";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { safeFileName, storagePath } from "@/lib/storage";

type KidsPackage = {
  title: string;
  description: string;
  tags: string[];
};

function client() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Add it to .env.local and restart the dev server.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

function imageModel() {
  return process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5";
}

async function downloadImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`OpenAI image download failed: ${response.status} ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
}

function kidsAspectRatio(value?: string | null) {
  return value === "9:16" ? "9:16" : "16:9";
}

function thumbnailPrompt(input: { title: string; ageRange: string; artStyle: string; aspectRatio?: string | null; storyTheme?: string | null }) {
  const ratio = kidsAspectRatio(input.aspectRatio);
  const composition = ratio === "9:16" ? "vertical 9:16 Shorts thumbnail" : "landscape 16:9 video thumbnail";
  return `Create a bright, colorful ${composition} for a child-safe story video.

Story title: "${input.title}"
Audience: ages ${input.ageRange}
Theme: ${input.storyTheme || "gentle adventure"}
Visual style: ${input.artStyle}

Requirements:
- cheerful, polished, parent-friendly kids story thumbnail
- clear main character moment with expressive happy emotion
- magical storybook background, colorful but not scary
- include short readable title text using the story title
- no logos, no watermarks, no unrelated brand names
- no extra text besides the title`;
}

async function generateThumbnail(input: {
  id: string;
  title: string;
  ageRange: string;
  artStyle: string;
  aspectRatio?: string | null;
  storyTheme?: string | null;
}) {
  const openai = client();
  const aspectRatio = kidsAspectRatio(input.aspectRatio);
  const size = aspectRatio === "9:16" ? "1024x1536" : "1536x1024";
  const response = await openai.images.generate({
    model: imageModel(),
    prompt: thumbnailPrompt(input),
    size,
    quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
    n: 1
  } as any);

  const image = response.data?.[0];
  const bytes = image?.b64_json ? Buffer.from(image.b64_json, "base64") : image?.url ? await downloadImage(image.url) : null;
  if (!bytes) throw new Error("OpenAI did not return image data for the thumbnail.");

  const thumbnailPath = storagePath("kids/thumbnails", `${safeFileName(input.title)}-${input.id.slice(0, 8)}-${aspectRatio.replace(":", "x")}-thumbnail.png`);
  await writeFile(thumbnailPath, bytes);
  return thumbnailPath;
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
          "Create manual upload metadata for original child-safe story videos. Return strict JSON with title, description, and tags. Keep it parent-friendly, non-clickbait, and safe for kids."
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
  "title": "A polished video title that includes the story name",
  "description": "2 short friendly paragraphs plus a simple parent-friendly call to action. Do not mention AI.",
  "tags": ["12 to 18 YouTube tags, no hashtag symbols"]
}`
      }
    ]
  });

  const raw = response.choices[0]?.message.content;
  if (!raw) throw new Error("OpenAI returned empty upload details.");
  const parsed = JSON.parse(raw) as Partial<KidsPackage>;
  const title = String(parsed.title || input.title || "").trim();
  return {
    title: title.includes(input.title) ? title : `${input.title} | Kids Story`,
    description: String(parsed.description || "").trim(),
    tags: parseTags(parsed.tags)
  };
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
  const thumbnailPath = await generateThumbnail({
    id: project.id,
    title: metadata.title,
    ageRange: project.ageRange,
    artStyle: project.artStyle,
    aspectRatio: project.aspectRatio,
    storyTheme: project.storyTheme
  });

  return prisma.kidsStoryProject.update({
    where: { id: project.id },
    data: {
      title: metadata.title,
      youtubeDescription: metadata.description,
      youtubeTags: metadata.tags.join(", "),
      thumbnailPath,
      errorMessage: null
    }
  });
}
