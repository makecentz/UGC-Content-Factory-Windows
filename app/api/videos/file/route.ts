import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("path");
  const download = searchParams.get("download") === "1";
  if (!filePath || !existsSync(filePath)) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  const stream = createReadStream(filePath);
  const stat = statSync(filePath);
  const contentType = filePath.endsWith(".mp4") ? "video/mp4" : /\.(png)$/i.test(filePath) ? "image/png" : /\.(jpe?g)$/i.test(filePath) ? "image/jpeg" : "application/octet-stream";
  return new Response(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      ...(download ? { "Content-Disposition": `attachment; filename="${path.basename(filePath).replace(/"/g, "")}"` } : {})
    }
  });
}
