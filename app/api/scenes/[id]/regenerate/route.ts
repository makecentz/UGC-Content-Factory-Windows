import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderOrRequestScene } from "@/lib/scene-pipeline";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  await prisma.scene.update({
    where: { id },
    data: {
      status: "regenerating",
      approved: false,
      errorMessage: null
    }
  });
  const scene = await renderOrRequestScene(id);
  return NextResponse.json(scene);
}
