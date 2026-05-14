import { NextResponse } from "next/server";
import { renderVerticalVideo } from "@/lib/ffmpeg";
import { selectFallbackBackground } from "@/lib/backgrounds";

export async function POST(request: Request) {
  const body = await request.json();
  try {
    const backgroundPath = body.backgroundPath || (await selectFallbackBackground(body.artStyle, body.niche));
    const outputPath = await renderVerticalVideo({ ...body, backgroundPath });
    return NextResponse.json({ ok: true, outputPath });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
