import OpenAI from "openai";

type KidsStoryInput = {
  prompt?: string | null;
  sourceTranscript?: string | null;
  ageRange: string;
  storyTheme?: string | null;
  moral?: string | null;
  artStyle: string;
  duration: string;
  aspectRatio?: string | null;
};

export type KidsStoryScenePlan = {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  prompt: string;
  camera: string;
  mood: string;
  duration: number;
  startTime: number;
  endTime: number;
};

export type KidsStoryPlan = {
  title: string;
  moral: string;
  script: string;
  scenes: KidsStoryScenePlan[];
};

function client() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Add it to .env.local and restart the dev server.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function kidsDurationToSeconds(duration: string) {
  const match = duration.match(/\d+/);
  const value = match ? Number(match[0]) : 3;
  return duration.toLowerCase().includes("sec") ? value : value * 60;
}

export async function generateKidsStoryPlan(input: KidsStoryInput): Promise<KidsStoryPlan> {
  const openai = client();
  const targetSeconds = kidsDurationToSeconds(input.duration);
  const sceneCount = Math.max(4, Math.min(14, Math.ceil(targetSeconds / 18)));
  const aspectRatio = input.aspectRatio === "9:16" ? "9:16 vertical YouTube Shorts" : "16:9 landscape YouTube";
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You create safe, original YouTube Kids story videos. Return strict JSON with title, moral, script, and scenes. No visible text, subtitles, logos, brand names, copyrighted characters, copied dialogue, or scary/unsafe content."
      },
      {
        role: "user",
	        content: `Create an original ${input.duration} ${aspectRatio} kids story for ages ${input.ageRange}.
Theme: ${input.storyTheme || "gentle adventure"}. Moral: ${input.moral || "choose a simple positive lesson"}.
Visual style: ${input.artStyle}.
User prompt: ${input.prompt || "none"}.
${input.sourceTranscript ? `Source transcript to transform only at the high-level. Do not copy the story, characters, names, sequence, dialogue, or jokes. Make a fresh child-safe version inspired by broad educational themes:\n${input.sourceTranscript.slice(0, 12000)}` : ""}

Return JSON:
{
  "title": string,
  "moral": string,
  "script": string,
  "scenes": [
    {
      "sceneNumber": number,
      "narration": string,
      "visualDescription": string,
      "prompt": string,
      "camera": string,
      "mood": string,
      "duration": number,
      "startTime": number,
      "endTime": number
    }
  ]
}

Scene count: ${sceneCount}. Keep narration warm and simple. Every visual prompt must say: no text, no captions, no words on screen.`
      }
    ]
  });

  const raw = response.choices[0]?.message.content;
  if (!raw) throw new Error("OpenAI returned an empty kids story plan.");
  return JSON.parse(raw) as KidsStoryPlan;
}
