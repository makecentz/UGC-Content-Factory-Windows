import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const series = await prisma.series.findMany({
    orderBy: { createdAt: "desc" },
    include: { videos: { orderBy: { createdAt: "desc" }, take: 1 } }
  });
  return NextResponse.json(series);
}

export async function POST(request: Request) {
  const body = await request.json();
  const series = await prisma.series.create({
    data: {
      name: body.name,
      niche: body.niche,
      customNiche: body.customNiche || null,
      language: body.language || "English",
      voice: body.voice,
      artStyle: body.artStyle,
      captionStyle: body.captionStyle,
      backgroundMusic: body.backgroundMusic || "none",
      effects: JSON.stringify(body.effects ?? []),
      videoDuration: body.videoDuration,
      scheduleTime: body.scheduleTime || null,
      postingFrequency: body.postingFrequency,
      autoGenerate: Boolean(body.autoGenerate),
      platforms: JSON.stringify(body.platforms ?? []),
      generationMode: body.generationMode || "story-video",
      videoProvider: body.videoProvider || process.env.DEFAULT_VIDEO_PROVIDER || "local-comfyui-wan22",
      useSceneConsistency: body.useSceneConsistency ?? true,
      preferredSceneDuration: Number(body.preferredSceneDuration || 5),
      transitionStyle: body.transitionStyle || "hard cut",
      storyboardEnabled: body.storyboardEnabled ?? true
    }
  });
  return NextResponse.json(series, { status: 201 });
}
