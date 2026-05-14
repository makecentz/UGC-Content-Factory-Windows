import { NextResponse } from "next/server";
import OpenAI from "openai";

async function imagePart(file: File | null) {
  if (!file || file.size === 0) return null;
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    type: "image_url" as const,
    image_url: {
      url: `data:${file.type || "image/png"};base64,${buffer.toString("base64")}`
    }
  };
}

function fallbackBrief(form: FormData) {
  const productName = String(form.get("productName") || "the product");
  const category = String(form.get("productCategory") || "the category");
  const benefits = String(form.get("productBenefits") || "the key benefits");
  const cta = String(form.get("ctaText") || "shop now");
  const style = String(form.get("style") || "Selfie Review");
  const platform = String(form.get("platform") || "TikTok");
  const duration = String(form.get("duration") || "30 sec");
  const vibe = String(form.get("creatorVibe") || "relatable");

  return `Create a ${duration} ${platform} ${style} UGC ad for ${productName}, a ${category} product. Make it feel ${vibe}, authentic, and natural, like a creator recommending something they actually use. Show the creator introducing the product, holding it clearly, demonstrating how it fits into their routine, reacting to the result, and ending with a confident "${cta}" CTA. Focus on these benefits: ${benefits}. Keep each scene simple, vertical 9:16, product-forward, and suitable for AI video generation with no on-screen text baked into the clips.`;
}

export async function POST(request: Request) {
  const form = await request.formData();
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ brief: fallbackBrief(form) });

  const productImage = await imagePart(form.get("productImage") as File | null);
  const creatorImage = await imagePart(form.get("creatorImage") as File | null);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const content = [
    {
      type: "text" as const,
      text: `Write a single polished UGC ad generation brief for ReelPilot.

Use the completed form data and uploaded reference images. The brief should guide AI scriptwriting and AI scene generation.

Product name: ${String(form.get("productName") || "")}
Product URL: ${String(form.get("productUrl") || "not provided")}
Product category: ${String(form.get("productCategory") || "")}
Product description: ${String(form.get("productDescription") || "")}
Product benefits: ${String(form.get("productBenefits") || "")}
Offer: ${String(form.get("offerText") || "none")}
CTA: ${String(form.get("ctaText") || "Shop now")}
Target audience: ${String(form.get("targetAudience") || "general shoppers")}
Creator vibe: ${String(form.get("creatorVibe") || "relatable")}
Creator gender note: ${String(form.get("creatorGender") || "not specified")}
Creator age range: ${String(form.get("creatorAgeRange") || "not specified")}
Duration: ${String(form.get("duration") || "30 sec")}
Platform: ${String(form.get("platform") || "TikTok")}
UGC style: ${String(form.get("style") || "Selfie Review")}

Write in first-person creative direction language. Include suggested visual beats: hook, product close-up, product in hand, demo/use, reaction, lifestyle payoff, CTA. Mention that product and creator references should be used for consistency. Do not include markdown. Keep it under 170 words.`
    },
    ...(productImage ? [productImage] : []),
    ...(creatorImage ? [creatorImage] : [])
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You create concise, production-ready UGC ad briefs for AI video generation." },
      { role: "user", content }
    ]
  });

  return NextResponse.json({ brief: response.choices[0]?.message.content?.trim() || fallbackBrief(form) });
}
