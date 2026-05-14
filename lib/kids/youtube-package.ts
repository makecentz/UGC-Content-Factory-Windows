import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

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

  return prisma.kidsStoryProject.update({
    where: { id: project.id },
    data: {
      title: metadata.title,
      youtubeDescription: metadata.description,
      youtubeTags: metadata.tags.join(", "),
      errorMessage: null
    }
  });
}
