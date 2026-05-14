import type { DramaShortProject } from "@prisma/client";
import OpenAI from "openai";

export type DramaCharacter = {
  name: string;
  role: string;
  ageRange: string;
  physicalDescription: string;
  wardrobe: string;
  personality: string;
  continuityPrompt: string;
};

export type DramaCharacterBible = {
  characters: DramaCharacter[];
  settingContinuity: string;
  visualContinuityPrompt: string;
};

function client() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function fallbackCharacters(project: DramaShortProject, script?: string | null): DramaCharacterBible {
  const title = project.title || "Drama Short";
  return {
    characters: [
      {
        name: "Main Character",
        role: `lead character in ${title}`,
        ageRange: "late 20s to late 30s",
        physicalDescription: "realistic everyday adult with expressive eyes, natural skin texture, and grounded human features",
        wardrobe: "modern neutral clothing that stays identical in every scene",
        personality: "tense, emotional, guarded, determined",
        continuityPrompt: "Keep the same face, age, hair, body type, wardrobe, and emotional acting continuity in every scene."
      }
    ],
    settingContinuity: "Grounded modern suspense setting with consistent lighting, props, and locations across scenes.",
    visualContinuityPrompt: `Use the same cast and continuity for every shot. Story reference: ${(script || project.description).slice(0, 500)}`
  };
}

export function parseDramaCharacterBible(value?: string | null): DramaCharacterBible | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<DramaCharacterBible>;
    const characters = Array.isArray(parsed.characters)
      ? parsed.characters
          .map((character) => ({
            name: clean(character?.name) || "Unnamed Character",
            role: clean(character?.role) || "story character",
            ageRange: clean(character?.ageRange) || "adult",
            physicalDescription: clean(character?.physicalDescription) || "realistic human features",
            wardrobe: clean(character?.wardrobe) || "consistent wardrobe",
            personality: clean(character?.personality) || "dramatic, emotional",
            continuityPrompt: clean(character?.continuityPrompt) || "Keep this character identical across every scene."
          }))
          .filter((character) => character.name)
      : [];
    return {
      characters,
      settingContinuity: clean(parsed.settingContinuity),
      visualContinuityPrompt: clean(parsed.visualContinuityPrompt)
    };
  } catch {
    return {
      characters: [],
      settingContinuity: "",
      visualContinuityPrompt: value.trim()
    };
  }
}

export function formatCharacterBibleForPrompt(value?: string | null) {
  const bible = parseDramaCharacterBible(value);
  if (!bible) return "";
  const characterLines = bible.characters
    .map((character) =>
      [
        `${character.name}: ${character.role}`,
        `Age: ${character.ageRange}`,
        `Appearance: ${character.physicalDescription}`,
        `Wardrobe: ${character.wardrobe}`,
        `Personality: ${character.personality}`,
        `Continuity: ${character.continuityPrompt}`
      ].join("; ")
    )
    .join("\n");

  return [
    "CHARACTER CONTINUITY LOCK:",
    characterLines,
    bible.settingContinuity ? `Setting continuity: ${bible.settingContinuity}` : "",
    bible.visualContinuityPrompt ? `Overall continuity: ${bible.visualContinuityPrompt}` : "",
    "Every scene must use these same named characters with identical faces, hair, age, body type, wardrobe, and emotional continuity. Do not replace them with different people."
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatCharacterBibleForDisplay(value?: string | null) {
  const bible = parseDramaCharacterBible(value);
  if (!bible) return "";
  const characterLines = bible.characters.map((character) => {
    return `${character.name} - ${character.role}
Age: ${character.ageRange}
Look: ${character.physicalDescription}
Wardrobe: ${character.wardrobe}
Personality: ${character.personality}`;
  });
  return [
    ...characterLines,
    bible.settingContinuity ? `Setting: ${bible.settingContinuity}` : "",
    bible.visualContinuityPrompt ? `Continuity: ${bible.visualContinuityPrompt}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function characterBibleFromNotes(notes: string): string | null {
  const trimmed = notes.trim();
  if (!trimmed) return null;
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    return JSON.stringify({
      characters: [],
      settingContinuity: "",
      visualContinuityPrompt: trimmed
    } satisfies DramaCharacterBible);
  }
}

export async function generateDramaCharacterBible(project: DramaShortProject, script?: string | null): Promise<DramaCharacterBible> {
  const existing = parseDramaCharacterBible(project.characterBibleJson);
  if (existing?.characters.length) return existing;

  const openai = client();
  if (!openai) return fallbackCharacters(project, script);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Create a character continuity bible for AI video generation. Return strict JSON with characters, settingContinuity, visualContinuityPrompt. Characters must include name, role, ageRange, physicalDescription, wardrobe, personality, continuityPrompt. Keep descriptions specific enough to preserve the same person across text-to-video scenes."
      },
      {
        role: "user",
        content: `Drama short title: ${project.title}
Description: ${project.description}
Script: ${script || project.script || ""}
Visual style: ${project.style}

Rules:
- Use only characters needed for the story.
- Give every major person a name, role, face/hair/body description, age range, and wardrobe.
- Wardrobe must be simple and repeatable across all scenes.
- Avoid copyrighted characters or celebrity likenesses.
- The continuity prompt should tell a video model how to keep the same person in every scene.`
      }
    ]
  });

  const raw = response.choices[0]?.message.content;
  if (!raw) return fallbackCharacters(project, script);
  const parsed = parseDramaCharacterBible(raw);
  return parsed?.characters.length ? parsed : fallbackCharacters(project, script);
}
