import { execFile } from "node:child_process";
import { NextResponse } from "next/server";
import OpenAI from "openai";

type YouTubeMetadata = {
  title?: string;
  description?: string;
  channel?: string;
  duration?: number;
  categories?: string[];
  tags?: string[];
};

type KidsStoryFields = {
  title: string;
  prompt: string;
  ageRange: string;
  storyTheme: string;
  moral: string;
  duration: string;
  artStyle: string;
  voice: string;
};

function run(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    execFile(command, args, { maxBuffer: 1024 * 1024 * 8 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

function ytDlpPath() {
  return process.env.YT_DLP_PATH || "yt-dlp";
}

function isYouTubeUrl(value: string) {
  try {
    const url = new URL(value);
    return ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function readYtDlpMetadata(url: string): Promise<YouTubeMetadata | null> {
  try {
    const raw = await run(ytDlpPath(), ["--dump-single-json", "--skip-download", "--no-warnings", url]);
    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      title: String(data.title || ""),
      description: String(data.description || ""),
      channel: String(data.channel || data.uploader || ""),
      duration: typeof data.duration === "number" ? data.duration : undefined,
      categories: Array.isArray(data.categories) ? data.categories.map(String) : [],
      tags: Array.isArray(data.tags) ? data.tags.map(String).slice(0, 24) : []
    };
  } catch {
    return null;
  }
}

async function readOembedMetadata(url: string): Promise<YouTubeMetadata | null> {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      title: String(data.title || ""),
      channel: String(data.author_name || ""),
      description: ""
    };
  } catch {
    return null;
  }
}

function durationOption(seconds?: number) {
  if (!seconds) return "3 min";
  if (seconds <= 90) return "60 sec";
  if (seconds <= 150) return "2 min";
  if (seconds <= 240) return "3 min";
  return "5 min";
}

function fallbackFields(metadata: YouTubeMetadata): KidsStoryFields {
  const title = metadata.title?.replace(/\s*[|–-]\s*YouTube\s*$/i, "").trim() || "Untitled Kids Story";
  return {
    title,
    prompt: `Create a new, original child-safe story inspired by the broad idea of "${title}". Do not copy the video's characters, names, sequence, dialogue, jokes, or wording. Make it gentle, imaginative, and appropriate for YouTube Kids.`,
    ageRange: "4-8",
    storyTheme: metadata.categories?.[0] || "gentle adventure",
    moral: "kindness and problem solving",
    duration: durationOption(metadata.duration),
    artStyle: "Bright storybook animation",
    voice: "Nova - warm storyteller"
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const url = String(body.url || "").trim();
  if (!isYouTubeUrl(url)) {
    return NextResponse.json({ error: "Paste a valid YouTube link." }, { status: 400 });
  }

  const metadata = (await readYtDlpMetadata(url)) || (await readOembedMetadata(url));
  if (!metadata?.title) {
    return NextResponse.json({ error: "Could not read that YouTube link. Check the URL and make sure the bundled yt-dlp tool is available." }, { status: 400 });
  }

  const fallback = fallbackFields(metadata);
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ story: fallback, source: "metadata" });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Fill a YouTube Kids story creator form from YouTube metadata. Return strict JSON with title, prompt, ageRange, storyTheme, moral, duration, artStyle, voice. The output must describe a new original child-safe story and must not copy source characters, names, dialogue, sequence, jokes, brands, or copyrighted material."
        },
        {
          role: "user",
          content: `YouTube URL: ${url}
Video title: ${metadata.title || ""}
Channel: ${metadata.channel || ""}
Duration seconds: ${metadata.duration || "unknown"}
Categories: ${(metadata.categories || []).join(", ")}
Tags: ${(metadata.tags || []).join(", ")}
Description:
${(metadata.description || "").slice(0, 8000)}

Use only these exact dropdown values:
ageRange: 2-5, 4-8, 6-10, 8-12
duration: 60 sec, 2 min, 3 min, 5 min
artStyle: Bright storybook animation, Soft watercolor cartoon, Playful 3D animation, Paper cutout storybook, Cozy bedtime illustration
voice: Nova - warm storyteller, Shimmer - bright storyteller, Sage - calm narrator, Fable - whimsical narrator`
        }
      ]
    });
    const raw = response.choices[0]?.message.content;
    const story = raw ? { ...fallback, ...(JSON.parse(raw) as Partial<KidsStoryFields>) } : fallback;
    return NextResponse.json({ story, source: "ai" });
  } catch (error) {
    return NextResponse.json({ story: fallback, source: "metadata", warning: error instanceof Error ? error.message : "AI parsing failed." });
  }
}
