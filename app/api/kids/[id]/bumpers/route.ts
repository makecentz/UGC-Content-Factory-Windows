import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureStorage, safeFileName, saveBuffer } from "@/lib/storage";

type Props = { params: Promise<{ id: string }> };

const videoTypes = new Set(["mp4", "mov", "m4v", "webm"]);

async function saveVideo(file: File, projectId: string, title: string, type: "intro" | "outro") {
  if (!file || file.size === 0) return null;
  const extension = (file.name.split(".").pop() || "mp4").toLowerCase();
  if (!videoTypes.has(extension)) {
    throw new Error(`${type === "intro" ? "Intro" : "Outro"} must be an MP4, MOV, M4V, or WebM video.`);
  }
  const fileName = `${safeFileName(title)}-${projectId.slice(0, 8)}-${type}-${Date.now()}.${extension}`;
  return saveBuffer("kids/bumpers", fileName, Buffer.from(await file.arrayBuffer()));
}

export async function POST(request: Request, { params }: Props) {
  try {
    await ensureStorage();
    const { id } = await params;
    const project = await prisma.kidsStoryProject.findUnique({ where: { id } });
    if (!project) return NextResponse.json({ error: "Kids story project not found." }, { status: 404 });

    const form = await request.formData();
    const introFile = form.get("introVideo");
    const outroFile = form.get("outroVideo");
    const introVideoPath = introFile instanceof File ? await saveVideo(introFile, project.id, project.title, "intro") : null;
    const outroVideoPath = outroFile instanceof File ? await saveVideo(outroFile, project.id, project.title, "outro") : null;

    if (!introVideoPath && !outroVideoPath) {
      return NextResponse.json({ error: "Choose an intro or outro video to upload." }, { status: 400 });
    }

    const updated = await prisma.kidsStoryProject.update({
      where: { id: project.id },
      data: {
        ...(introVideoPath ? { introVideoPath } : {}),
        ...(outroVideoPath ? { outroVideoPath } : {}),
        finalVideoPath: null,
        status: project.status === "rendered" ? "ready" : project.status,
        errorMessage: null
      }
    });

    return NextResponse.json({
      id: updated.id,
      introVideoPath: updated.introVideoPath,
      outroVideoPath: updated.outroVideoPath
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
