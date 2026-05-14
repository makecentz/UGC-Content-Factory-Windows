import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveBuffer, safeFileName, storagePath } from "@/lib/storage";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const enabled = formData.get("enabled");
  const position = formData.get("position");
  const opacity = formData.get("opacity");

  let watermarkPath: string | undefined;
  if (file instanceof File && file.size > 0) {
    const extension = file.name.toLowerCase().endsWith(".png") ? "png" : "png";
    watermarkPath = await saveBuffer("watermarks", `${safeFileName(file.name.replace(/\.[^.]+$/, ""))}.${extension}`, Buffer.from(await file.arrayBuffer()));
  }

  const current = await prisma.settings.findFirst();
  const data = {
    watermarkPath: watermarkPath ?? current?.watermarkPath ?? null,
    watermarkEnabled: enabled === "true",
    watermarkPosition: String(position || current?.watermarkPosition || "bottom-right"),
    watermarkOpacity: Number(opacity || current?.watermarkOpacity || 0.7),
    exportsFolder: storagePath("exports")
  };

  const settings = current ? await prisma.settings.update({ where: { id: current.id }, data }) : await prisma.settings.create({ data });
  return NextResponse.json(settings);
}
