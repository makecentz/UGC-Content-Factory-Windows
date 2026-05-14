import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const scene = await prisma.uGCScene.update({
    where: { id },
    data: {
      editedPrompt: String(body.prompt || ""),
      status: "pending",
      approved: false,
      errorMessage: null
    }
  });
  return NextResponse.json(scene);
}
