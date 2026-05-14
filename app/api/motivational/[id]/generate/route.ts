import { NextResponse } from "next/server";
import { generateMotivationalShort } from "@/lib/motivational/pipeline";
import { logError } from "@/lib/logger";

type Props = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Props) {
  const { id } = await params;
  try {
    const project = await generateMotivationalShort(id);
    return NextResponse.json(project);
  } catch (error) {
    await logError("Motivational short generation failed", error, { projectId: id });
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
