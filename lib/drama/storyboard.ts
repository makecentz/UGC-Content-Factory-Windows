import type { DramaShortProject } from "@prisma/client";
import OpenAI from "openai";
import { formatCharacterBibleForPrompt } from "./characters";

export type DramaStoryboardScene = {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  camera: string;
  mood: string;
  duration: number;
  startTime: number;
  endTime: number;
  prompt: string;
};

export type DramaStoryboard = {
  title: string;
  scenes: DramaStoryboardScene[];
};

export function dramaDurationToSeconds(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 30;
}

function sceneCountForDuration(seconds: number) {
  if (seconds <= 15) return 3;
  if (seconds <= 30) return 5;
  if (seconds <= 45) return 7;
  return 8;
}

function splitSentences(script: string) {
  return script.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
}

function fallbackStoryboard(project: DramaShortProject): DramaStoryboard {
  const total = dramaDurationToSeconds(project.duration);
  const count = sceneCountForDuration(total);
  const sceneDuration = total / count;
  const lines = splitSentences(project.script || project.description || "");
  const scenes = Array.from({ length: count }, (_, index) => {
    const startTime = Number((index * sceneDuration).toFixed(2));
    const endTime = Number(((index + 1) * sceneDuration).toFixed(2));
    const narration = lines[index] || lines[lines.length - 1] || "The secret was waiting in the dark hallway.";
    const beat = index === 0 ? "opening hook" : index === count - 1 ? "final reveal" : "escalating suspense";
    return {
      sceneNumber: index + 1,
      narration,
      visualDescription: `${beat} in a grounded modern suspense scene.`,
      camera: index === 0 ? "slow handheld push-in" : "cinematic handheld close-up",
      mood: "tense, mysterious, dramatic",
      duration: Number(sceneDuration.toFixed(2)),
      startTime,
      endTime,
      prompt: `${beat}, use the established character bible exactly, 8K photorealistic cinematic suspense drama, vertical YouTube Shorts frame, natural human emotion, realistic lighting, shallow depth of field, no text.`
    };
  });
  return { title: project.title, scenes };
}

function client() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function generateDramaStoryboard(project: DramaShortProject): Promise<DramaStoryboard> {
  const openai = client();
  if (!openai) return fallbackStoryboard(project);
  const total = dramaDurationToSeconds(project.duration);
  const count = sceneCountForDuration(total);
  const characterContinuity = formatCharacterBibleForPrompt(project.characterBibleJson);
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Plan vertical AI video scenes for original drama and suspense YouTube Shorts. Return strict JSON with title and scenes. Every scene needs sceneNumber, narration, visualDescription, camera, mood, duration, startTime, endTime, prompt. Scene prompts must preserve the same character identities from the character bible."
      },
      {
        role: "user",
        content: `Create ${count} scenes for a ${total}-second vertical YouTube Short.
Title: ${project.title}
Description: ${project.description}
Script: ${project.script || ""}
Style: ${project.style}
${characterContinuity ? `\n${characterContinuity}\n` : ""}

Visual requirements:
- 1080x1920 vertical composition
- 8K photorealistic cinematic video
- drama and suspense niche
- no visible words, captions, subtitles, logos, watermarks, or readable screens
- realistic people, realistic lighting, grounded suspense, strong emotional close-ups
- reuse the exact same named characters, faces, age, hair, body type, wardrobe, and relationships in every scene
- each prompt should be ready for a text-to-video model`
      }
    ]
  });

  const raw = response.choices[0]?.message.content;
  if (!raw) return fallbackStoryboard(project);
  const parsed = JSON.parse(raw) as Partial<DramaStoryboard>;
  return { ...fallbackStoryboard(project), ...parsed };
}
