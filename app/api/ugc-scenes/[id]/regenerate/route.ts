import { NextResponse } from "next/server";
import { renderUGCScene } from "@/lib/ugc/pipeline";

type Props = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Props) {
  const { id } = await params;
  const scene = await renderUGCScene(id);
  return NextResponse.json(scene);
}
