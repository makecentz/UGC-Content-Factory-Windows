import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { uploadKidsStoryToYoutube } from "@/lib/youtube/publisher";

type Props = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Props) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : undefined;
    const project = await uploadKidsStoryToYoutube(id, connectionId);
    return NextResponse.json({
      id: project.id,
      youtubeVideoId: project.youtubeVideoId,
      youtubeVideoUrl: project.youtubeVideoUrl,
      youtubeUploadStatus: project.youtubeUploadStatus,
      youtubeUploadedAt: project.youtubeUploadedAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logError("Kids YouTube upload failed", error, { projectId: id });
    await prisma.kidsStoryProject.update({
      where: { id },
      data: { youtubeUploadStatus: "failed", errorMessage: message }
    }).catch(() => null);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
