import type { DramaShortProject } from "@prisma/client";
import OpenAI from "openai";

export type GeneratedDramaScript = {
  title: string;
  hook: string;
  script: string;
  caption: string;
};

function fallbackScript(project: DramaShortProject): GeneratedDramaScript {
  const premise = project.description.trim() || "A tense moment where one secret changes everything.";
  return {
    title: project.title || "The Secret at Midnight",
    hook: "She heard the phone ring from a room that had been locked for ten years.",
    script: `She heard the phone ring from a room that had been locked for ten years. At first, Mara thought it was the storm playing tricks on her. Then the old answering machine clicked on by itself, and a voice whispered her name. The message was dated tomorrow. When she turned around, every family photo on the wall had changed except one. In that picture, she was standing beside a man she had never met, holding the key already in her hand.`,
    caption: `${premise.slice(0, 120)} The ending changes everything.`
  };
}

function twoSentenceCaption(value?: string) {
  const sentences = (value || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  return sentences.slice(0, 2).join(" ").trim();
}

function textValue(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join("\n");
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

function client() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function generateDramaScript(project: DramaShortProject): Promise<GeneratedDramaScript> {
  const openai = client();
  if (!openai) return fallbackScript(project);
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write original YouTube Shorts drama and suspense scripts. Return strict JSON with title, hook, script, caption. Keep it cinematic, tense, safe for general audiences, and avoid graphic violence. The caption must be two sentences or fewer."
      },
      {
        role: "user",
        content: `Create a ${project.duration} YouTube Shorts drama/suspense script.
User description: ${project.description}
Visual style: ${project.style}
Voice: ${project.voice}

Rules:
- original story, no copyrighted characters
- suspenseful but platform-safe
- short spoken narration lines
- no stage directions in the script
- caption is two sentences or fewer, optimized for YouTube Shorts`
      }
    ]
  });

  const raw = response.choices[0]?.message.content;
  if (!raw) return fallbackScript(project);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const normalized = {
    title: textValue(parsed.title),
    hook: textValue(parsed.hook),
    script: textValue(parsed.script),
    caption: textValue(parsed.caption)
  };
  const fallback = fallbackScript(project);
  return {
    title: normalized.title || fallback.title,
    hook: normalized.hook || fallback.hook,
    script: normalized.script || fallback.script,
    caption: twoSentenceCaption(normalized.caption) || fallback.caption
  };
}
