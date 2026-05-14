import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderOrRequestScene } from "@/lib/scene-pipeline";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const scene = await prisma.scene.update({
    where: { id },
    data: {
      editedPrompt: body.prompt,
      status: "pending",
      approved: false,
      errorMessage: null
    }
  });
  return NextResponse.json(scene);
}

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const scene = await renderOrRequestScene(id);
  return NextResponse.json(scene);
}
