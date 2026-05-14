import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureStorage, safeFileName, saveBuffer } from "@/lib/storage";

async function saveUploads(files: File[], fallbackName: string) {
  const saved = [];
  for (const file of files) {
    if (!file || file.size === 0) continue;
    const extension = file.name.split(".").pop() || "png";
    const fileName = `${safeFileName(fallbackName)}-${Date.now()}-${saved.length}.${extension}`;
    const path = await saveBuffer("kids/characters", fileName, Buffer.from(await file.arrayBuffer()));
    saved.push({ type: "character-reference", filePath: path, originalFileName: file.name });
  }
  return saved;
}

function parseAspectRatio(value: FormDataEntryValue | null) {
  return value === "9:16" ? "9:16" : "16:9";
}

export async function POST(request: Request) {
  try {
    await ensureStorage();
    const form = await request.formData();
    const youtubeUrl = String(form.get("youtubeUrl") || "") || null;
    const prompt = String(form.get("prompt") || "") || null;
    if (!youtubeUrl && !prompt) {
      return NextResponse.json({ error: "Add a YouTube link or a story prompt." }, { status: 400 });
    }
    const title = String(form.get("title") || "Untitled Kids Story");
    const files = form.getAll("characterImages").filter((item): item is File => item instanceof File);
    const assets = await saveUploads(files, title);
    const project = await prisma.kidsStoryProject.create({
      data: {
        title,
        sourceType: youtubeUrl ? "youtube" : "prompt",
        youtubeUrl,
        prompt,
        ageRange: String(form.get("ageRange") || "4-8"),
        storyTheme: String(form.get("storyTheme") || "") || null,
        moral: String(form.get("moral") || "") || null,
        artStyle: String(form.get("artStyle") || "Bright storybook animation"),
        characterMode: assets.length ? "uploaded" : "ai",
        duration: String(form.get("duration") || "3 min"),
        aspectRatio: parseAspectRatio(form.get("aspectRatio")),
        voiceProvider: String(form.get("voiceProvider") || "openai"),
        voice: String(form.get("voice") || "Nova - warm storyteller"),
        videoProvider: String(form.get("videoProvider") || "openai-image"),
        assets: { create: assets }
      }
    });
    return NextResponse.json({ id: project.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Could not create kids story: ${message}` }, { status: 500 });
  }
}
