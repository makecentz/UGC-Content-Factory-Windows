import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import OpenAI from "openai";

type ProductProfileInput = {
  productName: string;
  productCategory: string;
  productDescription: string;
  productBenefits: string;
  offerText?: string | null;
  ctaText?: string | null;
  targetAudience?: string | null;
};

export type ProductProfile = {
  productType: string;
  packagingAppearance: string;
  visibleColors: string[];
  shapeFormFactor: string;
  keyBenefits: string[];
  marketingAngle: string;
  promptDescriptors: string[];
};

function fallbackProfile(formData: ProductProfileInput): ProductProfile {
  return {
    productType: formData.productCategory || "consumer product",
    packagingAppearance: `${formData.productName} product packaging, shown clearly and naturally`,
    visibleColors: ["brand colors from reference image"],
    shapeFormFactor: "physical product matching the uploaded reference image",
    keyBenefits: formData.productBenefits.split(/\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 6),
    marketingAngle: formData.productDescription || "authentic UGC recommendation",
    promptDescriptors: [
      formData.productName,
      formData.productCategory,
      "product visible in hand",
      "matches uploaded product reference"
    ].filter(Boolean)
  };
}

export async function buildProductProfile(imagePath: string | null | undefined, formData: ProductProfileInput): Promise<ProductProfile> {
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
          "Create concise product reference notes for AI video prompts. Return strict JSON with productType, packagingAppearance, visibleColors, shapeFormFactor, keyBenefits, marketingAngle, promptDescriptors."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Product name: ${formData.productName}
Category: ${formData.productCategory}
Description: ${formData.productDescription}
Benefits: ${formData.productBenefits}
Offer: ${formData.offerText || "none"}
CTA: ${formData.ctaText || "none"}
Audience: ${formData.targetAudience || "general shoppers"}`
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
  return { ...fallbackProfile(formData), ...(JSON.parse(raw) as Partial<ProductProfile>) };
}
