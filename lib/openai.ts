import OpenAI from "openai";
import { createReadStream } from "node:fs";

type SeriesForGeneration = {
  name: string;
  niche: string;
  customNiche?: string | null;
  language: string;
  voice: string;
  artStyle: string;
  captionStyle: string;
  videoDuration: string;
};

export type GeneratedScript = {
  title: string;
  hook: string;
  script: string;
  description: string;
  hashtags: string;
};

function client() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Add it to .env.local and restart the dev server.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function generateVideoScript(series: SeriesForGeneration): Promise<GeneratedScript> {
  const openai = client();
  const niche = series.customNiche || series.niche;
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write punchy, ethical, original faceless short-form video scripts. Return strict JSON with title, hook, script, description, hashtags."
      },
      {
        role: "user",
        content: `Create a ${series.videoDuration} ${series.language} vertical short script for niche: ${niche}.
Voice style: ${series.voice}. Art style: ${series.artStyle}. Caption style: ${series.captionStyle}.
Use a strong first-sentence hook, short spoken lines, no copyrighted text, no stage directions. Hashtags should be one string.`
      }
    ]
  });

  const raw = response.choices[0]?.message.content;
  if (!raw) throw new Error("OpenAI returned an empty script response.");
  return JSON.parse(raw) as GeneratedScript;
}

export async function generateVoiceover(text: string, voice: string) {
  const openai = client();
  const voiceMap: Record<string, "alloy" | "ash" | "ballad" | "coral" | "echo" | "fable" | "nova" | "onyx" | "sage" | "shimmer"> = {
    adam: "onyx",
    john: "echo",
    echo: "echo",
    nova: "nova",
    sage: "sage",
    onyx: "onyx",
    shimmer: "shimmer"
  };
  const selectedVoice = voiceMap[voice.toLowerCase().split(" ")[0] || "onyx"] ?? "onyx";
  try {
    const audio = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: selectedVoice,
      input: text
    });
    return Buffer.from(await audio.arrayBuffer());
  } catch {
    const audio = await openai.audio.speech.create({
      model: "tts-1",
      voice: selectedVoice,
      input: text
    });
    return Buffer.from(await audio.arrayBuffer());
  }
}

export async function transcribeAudioFile(filePath: string) {
  const openai = client();
  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: createReadStream(filePath)
  });
  return response.text;
}
