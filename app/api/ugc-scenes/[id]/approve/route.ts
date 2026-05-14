import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Props) {
  const { id } = await params;
  const scene = await prisma.uGCScene.update({
    where: { id },
    data: { approved: true, status: "approved" }
  });
  return NextResponse.json(scene);
}
