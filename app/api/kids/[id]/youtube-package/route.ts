import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";
import { generateKidsYoutubePackage } from "@/lib/kids/youtube-package";

type Props = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const project = await generateKidsYoutubePackage(id);
    return NextResponse.json({
      id: project.id,
      title: project.title,
      youtubeDescription: project.youtubeDescription,
      youtubeTags: project.youtubeTags,
      thumbnailPath: project.thumbnailPath
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logError("Kids YouTube package generation failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
