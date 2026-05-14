import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Props) {
  const { id } = await params;
  await prisma.uGCProject.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
