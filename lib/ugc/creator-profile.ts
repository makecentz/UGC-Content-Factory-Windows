import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import OpenAI from "openai";

type CreatorProfileInput = {
  creatorName?: string | null;
  creatorVibe: string;
  creatorGender?: string | null;
  creatorAgeRange?: string | null;
};

export type CreatorProfile = {
  appearance: string;
  hairstyle: string;
  clothingStyle: string;
  vibe: string;
  ageRange: string;
  expression: string;
  consistencyRules: string[];
};

function fallbackProfile(formData: CreatorProfileInput): CreatorProfile {
  return {
    appearance: "creator matching the uploaded reference image, natural UGC presence",
    hairstyle: "consistent with the uploaded creator image",
    clothingStyle: "casual creator outfit consistent across scenes",
    vibe: formData.creatorVibe || "relatable",
    ageRange: formData.creatorAgeRange || "adult",
    expression: "friendly, authentic, confident",
    consistencyRules: [
      "Use the uploaded creator image as an appearance reference only.",
      "Keep the same person, hairstyle, wardrobe direction, and creator vibe across scenes.",
      "Do not imply the creator is a public figure."
    ]
  };
}

export async function buildCreatorProfile(imagePath: string | null | undefined, formData: CreatorProfileInput): Promise<CreatorProfile> {
  if (!process.env.OPENAI_API_KEY || !imagePath || !existsSync(imagePath)) return fallbackProfile(formData);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const image = await readFile(imagePath);
  const mimeType = imagePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Create private creator reference notes for AI UGC video prompts. Return strict JSON with appearance, hairstyle, clothingStyle, vibe, ageRange, expression, consistencyRules. Do not identify the person or assume they are a public figure."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Creator name: ${formData.creatorName || "unnamed"}
Vibe: ${formData.creatorVibe}
Gender note if provided: ${formData.creatorGender || "not specified"}
Age range if provided: ${formData.creatorAgeRange || "not specified"}
Use this image as a creative reference for appearance consistency only.`
          },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${image.toString("base64")}` }
          }
        ]
      }
    ]
  });

  const raw = response.choices[0]?.message.content;
  if (!raw) return fallbackProfile(formData);
  return { ...fallbackProfile(formData), ...(JSON.parse(raw) as Partial<CreatorProfile>) };
}
