import { NextResponse } from "next/server";
import OpenAI from "openai";

function fallbackStory(title: string) {
  const cleanTitle = title.trim() || "The Secret at Midnight";
  return {
    title: cleanTitle,
    description: `Create a suspenseful YouTube Shorts drama called "${cleanTitle}". Open with a tense emotional misunderstanding, reveal one hidden truth halfway through, and end with a surprising but satisfying twist. Keep the story grounded, cinematic, character-driven, and safe for general audiences.`,
    characters: `Mara - lead character
Age: late 20s to late 30s
Look: expressive eyes, natural realistic features, shoulder-length dark hair
Wardrobe: simple charcoal jacket over a white shirt, same outfit in every scene
Personality: guarded, emotional, determined`
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = String(body.title || "").trim();
    const duration = String(body.duration || "30 sec");
    const style = String(body.style || "8K photorealistic suspense drama");
    if (!title) return NextResponse.json({ error: "Enter a title first." }, { status: 400 });

    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ story: fallbackStory(title), source: "fallback" });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You create original drama and suspense premises for YouTube Shorts. Return strict JSON with title, description, and characters. Keep the story safe for general audiences, cinematic, emotional, and suspenseful. Characters should be a plain text continuity sheet with names, age range, physical look, wardrobe, and personality."
        },
        {
          role: "user",
          content: `Create an original ${duration} drama/suspense short premise from this title: ${title}
Visual style: ${style}

Return JSON:
{
  "title": "polished title, can improve the user's title but keep the same idea",
  "description": "one production-ready story description paragraph, 90 to 150 words, including characters, conflict, twist, ending direction, and consistency notes for AI video",
  "characters": "plain text character sheet. For each major character include name, role, age, appearance, wardrobe that stays identical in every scene, and personality."
}

No markdown. No copyrighted characters. No graphic violence.`
        }
      ]
    });
    const raw = response.choices[0]?.message.content;
    const parsed = raw ? (JSON.parse(raw) as Partial<{ title: string; description: string; characters: string }>) : {};
    const fallback = fallbackStory(title);
    return NextResponse.json({
      story: {
        title: String(parsed.title || fallback.title).trim(),
        description: String(parsed.description || fallback.description).trim(),
        characters: String(parsed.characters || fallback.characters).trim()
      },
      source: "ai"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
