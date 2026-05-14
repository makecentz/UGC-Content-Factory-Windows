import { NextResponse } from "next/server";
import { generateKidsStory } from "@/lib/kids/pipeline";
import { logError } from "@/lib/logger";

type Props = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const project = await generateKidsStory(id);
    return NextResponse.json({ id: project.id, status: project.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logError("Kids story generation route failed", error);
    console.error("[ReelPilot] Kids story generation failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
