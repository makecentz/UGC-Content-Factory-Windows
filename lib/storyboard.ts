import { writeFile } from "node:fs/promises";
import OpenAI from "openai";
import { getStylePreset } from "./style-presets";
import { storagePath } from "./storage";

export type StoryboardScene = {
  sceneNumber: number;
  startTime: number;
  endTime: number;
  duration: number;
  narration: string;
  visualDescription: string;
  camera: string;
  mood: string;
  prompt: string;
  status: "pending" | "generating" | "ready" | "failed";
};

export type CharacterBible = {
  mainCharacters: Array<{ name: string; appearance: string; clothing: string; traits: string }>;
  locations: string[];
  visualTone: string;
};

export type Storyboard = {
  title: string;
  hook: string;
  style: string;
  characterBible: CharacterBible;
  scenes: StoryboardScene[];
};

type SeriesForStoryboard = {
  name: string;
  niche: string;
  customNiche?: string | null;
  artStyle: string;
  useSceneConsistency?: boolean;
  preferredSceneDuration?: number;
};

function openaiClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function splitScriptIntoScenes(script: string, totalDuration: number, preferredSceneDuration = 5): StoryboardScene[] {
  const words = script.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const sceneCount = Math.max(3, Math.min(10, Math.round(totalDuration / Math.max(4, Math.min(6, preferredSceneDuration)))));
  const wordsPerScene = Math.ceil(words.length / sceneCount);

  return Array.from({ length: sceneCount }, (_, index) => {
    const startTime = Number(((index * totalDuration) / sceneCount).toFixed(2));
    const endTime = Number((((index + 1) * totalDuration) / sceneCount).toFixed(2));
    const narration = words.slice(index * wordsPerScene, index * wordsPerScene + wordsPerScene).join(" ");
    return {
      sceneNumber: index + 1,
      startTime,
      endTime,
      duration: Number((endTime - startTime).toFixed(2)),
      narration,
      visualDescription: `A clear story moment illustrating: ${narration}`,
      camera: "subtle slow push-in, vertical mobile framing",
      mood: "engaging, cinematic",
      prompt: "",
      status: "pending"
    };
  });
}

export function buildCharacterBible(script: string, niche: string, style: string): CharacterBible {
  return {
    mainCharacters: [
      {
        name: "primary story subject",
        appearance: "consistent age, silhouette, hairstyle, and facial structure across scenes",
        clothing: "simple distinctive outfit matching the story period and niche",
        traits: "expressive, readable emotions, visually consistent"
      }
    ],
    locations: [niche],
    visualTone: `${getStylePreset(style).overall}; consistent visual tone across the whole story. Script context: ${script.slice(0, 180)}`
  };
}

export function buildScenePrompt(scene: StoryboardScene, series: SeriesForStoryboard, characterBible: CharacterBible) {
  const preset = getStylePreset(series.artStyle);
  const consistency = series.useSceneConsistency
    ? `Keep recurring characters visually consistent: ${JSON.stringify(characterBible.mainCharacters)}.`
    : "No recurring character consistency required.";

  return `Vertical 9:16 ${preset.overall}. ${scene.visualDescription}. Narration context: "${scene.narration}". ${consistency} Location/tone: ${characterBible.visualTone}. Camera: ${scene.camera || preset.camera}. Mood: ${scene.mood}. Lighting: ${preset.lighting}. Motion: ${preset.motion}. Color palette: ${preset.colorPalette}. ${preset.promptSuffix}. Avoid text inside the generated visuals. Do not require lip sync.`;
}

function fallbackStoryboard(series: SeriesForStoryboard, script: string, duration: number): Storyboard {
  const scenes = splitScriptIntoScenes(script, duration, series.preferredSceneDuration);
  const characterBible = buildCharacterBible(script, series.customNiche || series.niche, series.artStyle);
  return {
    title: series.name,
    hook: scenes[0]?.narration ?? "",
    style: series.artStyle,
    characterBible,
    scenes: scenes.map((scene) => ({
      ...scene,
      prompt: buildScenePrompt(scene, series, characterBible)
    }))
  };
}

export async function generateStoryboard(series: SeriesForStoryboard, script: string, duration: number): Promise<Storyboard> {
  const client = openaiClient();
  const preset = getStylePreset(series.artStyle);

  if (!client) return fallbackStoryboard(series, script, duration);

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Create structured storyboards for faceless vertical videos. Return strict JSON with title, hook, style, characterBible, scenes. Scenes must be 4-6 seconds and illustrate narration without text or lip-sync dependency."
        },
        {
          role: "user",
          content: `Series: ${series.name}
Niche: ${series.customNiche || series.niche}
Style preset: ${JSON.stringify(preset)}
Total duration seconds: ${duration}
Preferred scene duration: ${series.preferredSceneDuration ?? 5}
Script: ${script}

Return JSON exactly shaped like:
{"title":"","hook":"","style":"","characterBible":{"mainCharacters":[],"locations":[],"visualTone":""},"scenes":[{"sceneNumber":1,"startTime":0,"endTime":5,"duration":5,"narration":"","visualDescription":"","camera":"","mood":"","prompt":"","status":"pending"}]}`
        }
      ]
    });

    const raw = response.choices[0]?.message.content;
    if (!raw) return fallbackStoryboard(series, script, duration);
    const parsed = JSON.parse(raw) as Storyboard;
    const characterBible = parsed.characterBible ?? buildCharacterBible(script, series.customNiche || series.niche, series.artStyle);
    const scenes = (parsed.scenes?.length ? parsed.scenes : splitScriptIntoScenes(script, duration, series.preferredSceneDuration)).map((scene, index) => ({
      ...scene,
      sceneNumber: scene.sceneNumber || index + 1,
      status: "pending" as const,
      prompt: scene.prompt || buildScenePrompt(scene, series, characterBible)
    }));
    return { ...parsed, style: parsed.style || series.artStyle, characterBible, scenes };
  } catch {
    return fallbackStoryboard(series, script, duration);
  }
}

export async function saveStoryboard(videoId: string, storyboard: Storyboard) {
  const path = storagePath("storyboards", `${videoId}.json`);
  await writeFile(path, JSON.stringify(storyboard, null, 2));
  return path;
}
