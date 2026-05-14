import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const channels = await prisma.youTubeChannelConnection.findMany({
    orderBy: [{ selected: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      channelId: true,
      channelTitle: true,
      channelThumbnailUrl: true,
      selected: true,
      updatedAt: true
    }
  });
  return NextResponse.json({ channels });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) throw new Error("Select a YouTube channel.");
    const channel = await prisma.youTubeChannelConnection.findUnique({ where: { id } });
    if (!channel) throw new Error("That YouTube channel is not saved.");
    await prisma.youTubeChannelConnection.updateMany({ data: { selected: false } });
    const selected = await prisma.youTubeChannelConnection.update({
      where: { id },
      data: { selected: true },
      select: {
        id: true,
        channelId: true,
        channelTitle: true,
        channelThumbnailUrl: true,
        selected: true
      }
    });
    return NextResponse.json({ channel: selected });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
