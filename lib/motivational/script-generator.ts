import type { MotivationalShortProject } from "@prisma/client";
import OpenAI from "openai";

export type GeneratedMotivationalScript = {
  title: string;
  hook: string;
  script: string;
  caption: string;
};

function client() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function textValue(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join("\n");
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

function twoSentenceCaption(value?: string) {
  const sentences = (value || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  return sentences.slice(0, 2).join(" ").trim();
}

function fallbackScript(project: MotivationalShortProject, transcript?: string | null): GeneratedMotivationalScript {
  const source = project.pastedScript || transcript || project.sourceTranscript || project.prompt || project.topic || "Keep going even when the results are not visible yet.";
  const title = project.title || project.topic || "Keep Going";
  const script =
    project.pastedScript?.trim() ||
    transcript?.trim() ||
    project.sourceTranscript?.trim() ||
    `You are not behind. You are being built. Every quiet day, every hard choice, every time you start again is proof that the next version of you is still alive. Take one step today, then another tomorrow. Momentum does not arrive all at once. It is earned in small promises kept when nobody is clapping.`;
  return {
    title,
    hook: source.split(/(?<=[.!?])\s+/)[0]?.slice(0, 140) || "You are closer than you think.",
    script,
    caption: twoSentenceCaption(project.caption || `${title}. One step today can change the whole direction.`) || "One step today can change the whole direction."
  };
}

export async function generateMotivationalScript(project: MotivationalShortProject, transcript?: string | null): Promise<GeneratedMotivationalScript> {
  const exactScript = project.pastedScript?.trim() || transcript?.trim() || project.sourceTranscript?.trim();
  if (exactScript) {
    const fallback = fallbackScript(project, transcript);
    return {
      ...fallback,
      script: exactScript
    };
  }

  const openai = client();
  if (!openai) return fallbackScript(project, transcript);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write original dramatic motivational YouTube Shorts scripts for a powerful male narrator. Return strict JSON with title, hook, script, caption. The caption must be two sentences or fewer. Keep it intense, direct, cinematic, emotionally charged, and safe for general audiences."
      },
      {
        role: "user",
        content: `Create a ${project.duration} vertical motivational short.
Mode: Use the user's prompt/topic to create a new original motivational short.
Working title: ${project.title}
Topic: ${project.topic || ""}
Tone: ${project.tone}
Style: ${project.style}
Prompt: ${project.prompt || ""}

Rules:
- spoken narration only, no stage directions
- no visible on-screen words
- no copyrighted speeches, brands, or copied phrasing
- short punchy lines that fit voiceover timing
- caption is two sentences or fewer`
      }
    ]
  });

  const raw = response.choices[0]?.message.content;
  if (!raw) return fallbackScript(project, transcript);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const fallback = fallbackScript(project, transcript);
  return {
    title: textValue(parsed.title) || fallback.title,
    hook: textValue(parsed.hook) || fallback.hook,
    script: textValue(parsed.script) || fallback.script,
    caption: twoSentenceCaption(textValue(parsed.caption)) || fallback.caption
  };
}
