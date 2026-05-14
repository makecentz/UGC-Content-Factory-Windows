import type { UGCProject } from "@prisma/client";
import OpenAI from "openai";

export type GeneratedUGCScript = {
  title: string;
  hook: string;
  script: string;
  cta: string;
  sceneOutline: string[];
};

function fallbackScript(project: UGCProject): GeneratedUGCScript {
  const cta = project.ctaText || "Check it out today.";
  return {
    title: `${project.productName} UGC Ad`,
    hook: `I did not expect ${project.productName} to make this much of a difference.`,
    script: `I did not expect ${project.productName} to make this much of a difference. I was looking for something simple for ${project.productCategory.toLowerCase()}, and this actually fit into my day. The thing I noticed first was ${project.productBenefits.split(/\n|,/)[0]?.trim() || "how easy it felt to use"}. It feels practical, looks good on camera, and makes the routine feel easier. ${cta}`,
    cta,
    sceneOutline: ["hook to camera", "product close-up", "demo shot", "reaction payoff", "CTA shot"]
  };
}

export async function generateUGCScript(project: UGCProject): Promise<GeneratedUGCScript> {
  if (!process.env.OPENAI_API_KEY) return fallbackScript(project);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write authentic short-form UGC ad scripts. Return strict JSON with title, hook, script, cta, sceneOutline. Keep the script conversational, ethical, and platform-friendly."
      },
      {
        role: "user",
        content: `Create a ${project.duration} ${project.platform} UGC ad.
Product: ${project.productName}
Category: ${project.productCategory}
Description: ${project.productDescription}
Benefits: ${project.productBenefits}
Offer: ${project.offerText || "none"}
CTA: ${project.ctaText || "Shop now"}
Audience: ${project.targetAudience || "general shoppers"}
Tone: ${project.tone}
UGC style: ${project.style}
Voice: ${project.voice}
Brief: ${project.brief}

Use this structure: Hook, Problem, Product intro, Benefit/demo, Emotional/social payoff, CTA. No stage directions inside the spoken script.`
      }
    ]
  });
  const raw = response.choices[0]?.message.content;
  if (!raw) return fallbackScript(project);
  return { ...fallbackScript(project), ...(JSON.parse(raw) as Partial<GeneratedUGCScript>) };
}
