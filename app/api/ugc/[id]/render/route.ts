import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";
import { renderUGCFinalVideo } from "@/lib/ugc/pipeline";

type Props = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Props) {
  const { id } = await params;
  try {
    const project = await renderUGCFinalVideo(id);
    return NextResponse.json(project);
  } catch (error) {
    await logError("UGC final render failed", error, { projectId: id });
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
