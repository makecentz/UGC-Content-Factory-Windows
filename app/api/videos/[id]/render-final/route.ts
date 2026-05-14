import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stitchSceneClips } from "@/lib/scene-pipeline";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const video = await prisma.video.findUnique({ where: { id }, include: { scenes: true } });
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  const readyCount = video.scenes.filter((scene) => scene.approved || scene.status === "ready" || scene.status === "approved").length;
  if (!readyCount) return NextResponse.json({ error: "No ready or approved scenes are available for final render." }, { status: 400 });
  const rendered = await stitchSceneClips(id);
  return NextResponse.json(rendered);
}
