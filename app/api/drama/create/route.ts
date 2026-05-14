import { NextResponse } from "next/server";
import { characterBibleFromNotes } from "@/lib/drama/characters";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { ensureStorage } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    await ensureStorage();
    const form = await request.formData();
    const description = String(form.get("description") || "").trim();
    if (!description) throw new Error("Describe the drama short you want to create.");
    const characterBibleJson = characterBibleFromNotes(String(form.get("characters") || ""));

    const project = await prisma.dramaShortProject.create({
      data: {
        title: String(form.get("title") || "Untitled Drama Short").trim() || "Untitled Drama Short",
        description,
        style: String(form.get("style") || "8K photorealistic suspense drama"),
        duration: String(form.get("duration") || "30 sec"),
        voice: String(form.get("voice") || "Onyx - tense narrator"),
        videoProvider: String(form.get("videoProvider") || "local-comfyui-wan22"),
        characterBibleJson
      }
    });

    return NextResponse.json({ id: project.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logError("Drama short project creation failed", error);
    return NextResponse.json({ error: `Could not create drama short: ${message}` }, { status: 500 });
  }
}
