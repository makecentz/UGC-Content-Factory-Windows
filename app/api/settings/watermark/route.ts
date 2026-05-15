import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveBuffer, safeFileName, storagePath } from "@/lib/storage";

const videoTypes = new Set(["mp4", "mov", "m4v", "webm"]);

async function saveDefaultVideo(file: File, type: "intro" | "outro") {
  if (!file || file.size === 0) return undefined;
  const extension = (file.name.split(".").pop() || "mp4").toLowerCase();
  if (!videoTypes.has(extension)) {
    throw new Error(`${type === "intro" ? "Intro" : "Outro"} must be an MP4, MOV, M4V, or WebM video.`);
  }
  return saveBuffer("kids/bumpers", `default-${type}-${Date.now()}-${safeFileName(file.name.replace(/\.[^.]+$/, ""))}.${extension}`, Buffer.from(await file.arrayBuffer()));
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const introFile = formData.get("introVideo");
    const outroFile = formData.get("outroVideo");
    const enabled = formData.get("enabled");
    const position = formData.get("position");
    const opacity = formData.get("opacity");

    let watermarkPath: string | undefined;
    if (file instanceof File && file.size > 0) {
      const extension = file.name.toLowerCase().endsWith(".png") ? "png" : "png";
      watermarkPath = await saveBuffer("watermarks", `${safeFileName(file.name.replace(/\.[^.]+$/, ""))}.${extension}`, Buffer.from(await file.arrayBuffer()));
    }
    const defaultIntroVideoPath = introFile instanceof File ? await saveDefaultVideo(introFile, "intro") : undefined;
    const defaultOutroVideoPath = outroFile instanceof File ? await saveDefaultVideo(outroFile, "outro") : undefined;

    const current = await prisma.settings.findFirst();
    const data = {
      watermarkPath: watermarkPath ?? current?.watermarkPath ?? null,
      watermarkEnabled: enabled === "true",
      watermarkPosition: String(position || current?.watermarkPosition || "bottom-right"),
      watermarkOpacity: Number(opacity || current?.watermarkOpacity || 0.7),
      defaultIntroVideoPath: defaultIntroVideoPath ?? current?.defaultIntroVideoPath ?? null,
      defaultOutroVideoPath: defaultOutroVideoPath ?? current?.defaultOutroVideoPath ?? null,
      exportsFolder: storagePath("exports")
    };

    const settings = current ? await prisma.settings.update({ where: { id: current.id }, data }) : await prisma.settings.create({ data });
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
