import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateVideoForSeries } from "@/lib/video-pipeline";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await prisma.video.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const video = await prisma.video.update({ where: { id }, data: body });
  return NextResponse.json(video);
}

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  const regenerated = await generateVideoForSeries(video.seriesId);
  return NextResponse.json(regenerated);
}
