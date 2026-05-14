import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";
import { generateVideoForSeries, ensureTestSeries } from "@/lib/video-pipeline";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const series = body.test ? await ensureTestSeries() : null;
    const seriesId = body.seriesId || series?.id;
    if (!seriesId) return NextResponse.json({ error: "Missing seriesId." }, { status: 400 });
    const video = await generateVideoForSeries(seriesId);
    return NextResponse.json(video);
  } catch (error) {
    await logError("Series video generation failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
