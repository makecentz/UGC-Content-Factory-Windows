import { execFile } from "node:child_process";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { isYouTubeUrl } from "@/lib/motivational/youtube";

type YouTubeMetadata = {
  title?: string;
  description?: string;
  channel?: string;
  duration?: number;
  categories?: string[];
  tags?: string[];
};

type MotivationalFields = {
  title: string;
  prompt: string;
  topic: string;
  tone: string;
  duration: string;
  style: string;
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
  if (!seconds) return "30 sec";
  if (seconds <= 20) return "15 sec";
  if (seconds <= 40) return "30 sec";
  if (seconds <= 55) return "45 sec";
  return "60 sec";
}

function fallbackFields(metadata: YouTubeMetadata): MotivationalFields {
  const title = metadata.title?.replace(/\s*[|–-]\s*YouTube\s*$/i, "").trim() || "Untitled Motivational Short";
  return {
    title,
    prompt: `Create a new, original motivational short inspired by the broad message of "${title}". Do not copy exact wording, sequence, quotes, speaker identity, or signature phrases from the source video.`,
    topic: metadata.categories?.[0] || "discipline and resilience",
    tone: "intense",
    duration: durationOption(metadata.duration),
    style: "8K photorealistic dramatic motivational cinematic video",
    voice: "Onyx - powerful male narrator"
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
            "Fill a motivational YouTube Shorts creator form from YouTube metadata. Return strict JSON with title, prompt, topic, tone, duration, style, voice. The output must describe a new original motivational short and must not copy source wording, exact sequence, speaker identity, or copyrighted material."
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
duration: 15 sec, 30 sec, 45 sec, 60 sec
tone: intense, comeback, disciplined, cinematic grit, uplifting
style: 8K photorealistic dramatic motivational cinematic video, 8K photorealistic gym discipline drama, 8K photorealistic entrepreneur comeback drama, 8K photorealistic cinematic life transformation
voice: Onyx - powerful male narrator, Echo - grounded male narrator, Nova - inspiring female narrator`
        }
      ]
    });
    const raw = response.choices[0]?.message.content;
    const story = raw ? { ...fallback, ...(JSON.parse(raw) as Partial<MotivationalFields>) } : fallback;
    return NextResponse.json({ story, source: "ai" });
  } catch (error) {
    return NextResponse.json({ story: fallback, source: "metadata", warning: error instanceof Error ? error.message : "AI parsing failed." });
  }
}
