import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const scene = await prisma.scene.update({
    where: { id },
    data: {
      approved: true,
      status: "approved"
    }
  });
  return NextResponse.json(scene);
}
