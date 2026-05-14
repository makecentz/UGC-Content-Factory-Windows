import { NextResponse } from "next/server";
import { renderDramaFinalVideo } from "@/lib/drama/pipeline";
import { logError } from "@/lib/logger";

type Props = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Props) {
  const { id } = await params;
  try {
    const project = await renderDramaFinalVideo(id);
    return NextResponse.json(project);
  } catch (error) {
    await logError("Drama final render failed", error, { projectId: id });
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
