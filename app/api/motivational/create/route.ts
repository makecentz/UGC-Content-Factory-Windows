import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { ensureStorage, safeFileName, saveBuffer } from "@/lib/storage";

async function saveWatermark(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size <= 0) return null;
  const extension = file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg") ? "jpg" : "png";
  const fileName = `${safeFileName(file.name.replace(/\.[^.]+$/, ""))}-${Date.now()}.${extension}`;
  return saveBuffer("motivational/watermarks", fileName, Buffer.from(await file.arrayBuffer()));
}

export async function POST(request: Request) {
  try {
    await ensureStorage();
    const form = await request.formData();
    const youtubeUrl = String(form.get("youtubeUrl") || "").trim();
    const prompt = String(form.get("prompt") || "").trim();
    const pastedScript = String(form.get("pastedScript") || "").trim();
    if (!youtubeUrl && !prompt && !pastedScript) {
      throw new Error("Add a YouTube link, paste a script, or describe the motivational short.");
    }
    const sourceType = pastedScript ? "script" : youtubeUrl ? "youtube" : "prompt";
    const watermarkPath = await saveWatermark(form.get("watermark"));
    const watermarkPosition = String(form.get("watermarkPosition") || "bottom-right");

    const project = await prisma.motivationalShortProject.create({
      data: {
        title: String(form.get("title") || "Untitled Motivational Short").trim() || "Untitled Motivational Short",
        sourceType,
        youtubeUrl: youtubeUrl || null,
        prompt: prompt || null,
        pastedScript: pastedScript || null,
        topic: String(form.get("topic") || "").trim() || null,
        tone: String(form.get("tone") || "intense"),
        style: String(form.get("style") || "8K photorealistic dramatic motivational cinematic video"),
        duration: String(form.get("duration") || "30 sec"),
        voice: String(form.get("voice") || "Onyx - powerful male narrator"),
        videoProvider: String(form.get("videoProvider") || "local-comfyui-wan22"),
        captionsEnabled: form.get("captionsEnabled") === "true",
        captionStyle: String(form.get("captionStyle") || "Bold Stroke"),
        watermarkPath,
        watermarkPosition: ["top-left", "bottom-right"].includes(watermarkPosition) ? watermarkPosition : "bottom-right"
      }
    });

    return NextResponse.json({ id: project.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logError("Motivational short project creation failed", error);
    return NextResponse.json({ error: `Could not create motivational short: ${message}` }, { status: 500 });
  }
}
