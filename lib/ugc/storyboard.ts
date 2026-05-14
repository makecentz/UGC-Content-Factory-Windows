import type { UGCProject } from "@prisma/client";
import OpenAI from "openai";

export type UGCStoryboardScene = {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  shotType: string;
  camera: string;
  mood: string;
  duration: number;
  startTime: number;
  endTime: number;
  prompt: string;
};

export type UGCStoryboard = {
  title: string;
  hook: string;
  scenes: UGCStoryboardScene[];
};

function durationSeconds(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 30;
}

function sceneCountForDuration(seconds: number) {
  if (seconds <= 15) return 4;
  if (seconds <= 30) return 6;
  if (seconds <= 45) return 7;
  return 9;
}

function fallbackStoryboard(project: UGCProject): UGCStoryboard {
  const total = durationSeconds(project.duration);
  const count = sceneCountForDuration(total);
  const sceneDuration = total / count;
  const shotTypes = ["Hook to camera", "Product close-up", "Product in hand", "Demo / use shot", "Reaction shot", "Lifestyle payoff shot", "CTA shot", "Product beauty shot", "Final selfie CTA"];
  const scriptLines = (project.script || project.brief || "").split(/(?<=[.!?])\s+/).filter(Boolean);
  const scenes = Array.from({ length: count }, (_, index) => {
    const startTime = Number((index * sceneDuration).toFixed(2));
    const endTime = Number(((index + 1) * sceneDuration).toFixed(2));
    const shotType = shotTypes[index] || "UGC ad shot";
    return {
      sceneNumber: index + 1,
      narration: scriptLines[index] || scriptLines[0] || `${project.productName} makes this routine feel easier.`,
      visualDescription: `${shotType} featuring the creator and ${project.productName}.`,
      shotType,
      camera: index === 0 ? "handheld selfie camera" : "natural handheld UGC camera",
      mood: project.tone,
      duration: Number(sceneDuration.toFixed(2)),
      startTime,
      endTime,
      prompt: `${shotType} for a ${project.style} UGC ad, product clearly visible, authentic creator energy.`
    };
  });
  return { title: project.title, hook: project.hook || "", scenes };
}

export async function generateUGCStoryboard(project: UGCProject): Promise<UGCStoryboard> {
  if (!process.env.OPENAI_API_KEY) return fallbackStoryboard(project);
  const total = durationSeconds(project.duration);
  const count = sceneCountForDuration(total);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Plan short-form UGC ad storyboards. Return strict JSON with title, hook, scenes. Each scene has sceneNumber, narration, visualDescription, shotType, camera, mood, duration, startTime, endTime, prompt."
      },
      {
        role: "user",
        content: `Create ${count} scenes for a ${total}-second vertical UGC ad.
Product: ${project.productName}
Style: ${project.style}
Tone: ${project.tone}
Platform: ${project.platform}
Hook: ${project.hook || ""}
Script: ${project.script || ""}

Use common UGC shot types: hook to camera, product close-up, product in hand, demo/use shot, reaction shot, lifestyle payoff shot, CTA shot.
Keep each scene simple, visual, and easy for an AI video model. No baked-in text.`
      }
    ]
  });
  const raw = response.choices[0]?.message.content;
  if (!raw) return fallbackStoryboard(project);
  return { ...fallbackStoryboard(project), ...(JSON.parse(raw) as Partial<UGCStoryboard>) };
}
