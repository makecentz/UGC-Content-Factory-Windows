import type { MotivationalShortProject } from "@prisma/client";
import OpenAI from "openai";

export type MotivationalStoryboardScene = {
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

export type MotivationalStoryboard = {
  title: string;
  scenes: MotivationalStoryboardScene[];
};

export function motivationalDurationToSeconds(value: string) {
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

function exactNarrationChunks(script: string, count: number) {
  const lines = splitSentences(script);
  if (!lines.length) return Array.from({ length: count }, () => "Your next step is still waiting for you.");
  const chunks: string[] = [];
  const perChunk = Math.ceil(lines.length / count);
  for (let index = 0; index < count; index += 1) {
    const chunk = lines.slice(index * perChunk, (index + 1) * perChunk).join(" ").trim();
    chunks.push(chunk || lines[lines.length - 1]);
  }
  return chunks.slice(0, count);
}

function client() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function fallbackStoryboard(project: MotivationalShortProject): MotivationalStoryboard {
  const total = motivationalDurationToSeconds(project.duration);
  const count = sceneCountForDuration(total);
  const sceneDuration = total / count;
  const lines = exactNarrationChunks(project.script || project.pastedScript || project.prompt || "", count);
  const scenes = Array.from({ length: count }, (_, index) => {
    const startTime = Number((index * sceneDuration).toFixed(2));
    const endTime = Number(((index + 1) * sceneDuration).toFixed(2));
    const narration = lines[index] || lines[lines.length - 1] || "Your next step is still waiting for you.";
    const beat = index === 0 ? "dramatic opening hook" : index === count - 1 ? "powerful breakthrough ending" : "high-pressure discipline moment";
    return {
      sceneNumber: index + 1,
      narration,
      visualDescription: `${beat} with cinematic realistic people fighting through pressure, exhaustion, doubt, and a meaningful personal challenge.`,
      camera: index === 0 ? "slow low-angle push-in with shallow depth of field" : "dramatic handheld movement with close-ups and fast cutaway energy",
      mood: "intense, dramatic, resilient, focused",
      duration: Number(sceneDuration.toFixed(2)),
      startTime,
      endTime,
      prompt: `${beat}, 8K photorealistic dramatic cinematic motivational video, vertical 1080x1920, authentic human emotion, rain or sweat or harsh shadows, golden backlight, disciplined action under pressure, comeback energy, no text.`
    };
  });
  return { title: project.title, scenes };
}

function normalizeStoryboard(project: MotivationalShortProject, storyboard: Partial<MotivationalStoryboard>): MotivationalStoryboard {
  const total = motivationalDurationToSeconds(project.duration);
  const count = sceneCountForDuration(total);
  const sceneDuration = total / count;
  const fallback = fallbackStoryboard(project);
  const visualScenes = storyboard.scenes?.length ? storyboard.scenes : fallback.scenes;
  const narrationChunks = exactNarrationChunks(project.script || project.pastedScript || project.prompt || "", count);
  const scenes = Array.from({ length: count }, (_, index) => {
    const visual = visualScenes[index] || visualScenes[visualScenes.length - 1] || fallback.scenes[index];
    const startTime = Number((index * sceneDuration).toFixed(2));
    const endTime = Number(((index + 1) * sceneDuration).toFixed(2));
    return {
      ...fallback.scenes[index],
      ...visual,
      sceneNumber: index + 1,
      narration: narrationChunks[index] || fallback.scenes[index].narration,
      duration: Number(sceneDuration.toFixed(2)),
      startTime,
      endTime
    };
  });
  return { title: storyboard.title || project.title, scenes };
}

export async function generateMotivationalStoryboard(project: MotivationalShortProject): Promise<MotivationalStoryboard> {
  const openai = client();
  if (!openai) return fallbackStoryboard(project);
  const total = motivationalDurationToSeconds(project.duration);
  const count = sceneCountForDuration(total);
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Plan vertical AI video scenes for dramatic motivational YouTube Shorts. Return strict JSON with title and scenes. Every scene needs sceneNumber, narration, visualDescription, camera, mood, duration, startTime, endTime, prompt. Make the visuals feel intense, cinematic, emotional, and high-impact without adding on-screen text."
      },
      {
        role: "user",
        content: `Create ${count} scenes for a ${total}-second motivational YouTube Short.
Title: ${project.title}
Topic: ${project.topic || ""}
Tone: ${project.tone}
Script: ${project.script || ""}
Style: ${project.style}

Visual requirements:
- 1080x1920 vertical composition
- 8K photorealistic dramatic cinematic visuals generated from the script
- motivational niche: resilience, pressure, focus, discipline, sacrifice, comeback energy
- no visible words, captions, subtitles, logos, watermarks, or readable screens
- avoid repetitive visuals; make each scene a clear emotional beat with stronger drama, contrast, stakes, and movement
- use cinematic lighting, close-ups, sweat/rain/shadows/golden backlight when appropriate
- do not rewrite the script; visual prompts should be based on the script only
- each prompt should be ready for a text-to-video model`
      }
    ]
  });

  const raw = response.choices[0]?.message.content;
  if (!raw) return fallbackStoryboard(project);
  const parsed = JSON.parse(raw) as Partial<MotivationalStoryboard>;
  return normalizeStoryboard(project, parsed);
}
