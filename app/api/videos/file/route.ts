import { createReadStream, existsSync, statSync } from "node:fs";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("path");
  if (!filePath || !existsSync(filePath)) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  const stream = createReadStream(filePath);
  const stat = statSync(filePath);
  return new Response(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": filePath.endsWith(".mp4") ? "video/mp4" : "application/octet-stream",
      "Content-Length": String(stat.size)
    }
  });
}
