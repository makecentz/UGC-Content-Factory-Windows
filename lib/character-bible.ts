import OpenAI from "openai";

export type CharacterBible = {
  mainCharacters: Array<{
    name: string;
    role: string;
    age: string;
    appearance: string;
    clothing: string;
    mood: string;
    consistencyRules: string;
  }>;
  locations: string[];
  visualTone: string;
  globalConsistencyRules: string[];
};

function fallbackBible(script: string, niche: string, style: string): CharacterBible {
  return {
    mainCharacters: [
      {
        name: "primary story subject",
        role: "central figure of the narration",
        age: "age appropriate to the story context",
        appearance: "consistent face shape, hairstyle, body type, and silhouette",
        clothing: "distinctive outfit that matches the era, niche, and visual style",
        mood: "expressive but grounded in the narration",
        consistencyRules: "Keep the same outfit, silhouette, color accents, and facial features in every scene where this subject appears."
      }
    ],
    locations: [niche],
    visualTone: `${style} visual tone based on script: ${script.slice(0, 220)}`,
    globalConsistencyRules: [
      "Keep recurring characters visually consistent across all scenes.",
      "Do not introduce new main characters unless narration requires them.",
      "Keep environments and era details consistent with the story."
    ]
  };
}

export async function generateCharacterBible(script: string, niche: string, style: string): Promise<CharacterBible> {
  if (!process.env.OPENAI_API_KEY) return fallbackBible(script, niche, style);

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Create compact character bibles for AI video scene consistency. Return strict JSON with mainCharacters, locations, visualTone, globalConsistencyRules."
        },
        {
          role: "user",
          content: `Niche: ${niche}
Style: ${style}
Script: ${script}

Each main character needs name, role, age, appearance, clothing, mood, and consistencyRules. Keep it concise and visually specific.`
        }
      ]
    });
    const raw = response.choices[0]?.message.content;
    if (!raw) return fallbackBible(script, niche, style);
    return JSON.parse(raw) as CharacterBible;
  } catch {
    return fallbackBible(script, niche, style);
  }
}

export function characterBiblePrompt(bible?: CharacterBible | null) {
  if (!bible) return "";
  return `Character bible for consistency: ${JSON.stringify(bible)}. Preserve the same recurring character appearance, clothing, age, role, mood, and defining traits across scenes.`;
}
