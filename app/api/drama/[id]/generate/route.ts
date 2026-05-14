import { NextResponse } from "next/server";
import { generateDramaShort } from "@/lib/drama/pipeline";
import { logError } from "@/lib/logger";

type Props = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Props) {
  const { id } = await params;
  try {
    const project = await generateDramaShort(id);
    return NextResponse.json(project);
  } catch (error) {
    await logError("Drama short generation failed", error, { projectId: id });
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
