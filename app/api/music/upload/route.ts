import { NextResponse } from "next/server";
import { saveBuffer, safeFileName } from "@/lib/storage";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing MP3 file." }, { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = await saveBuffer("music", `${safeFileName(file.name.replace(/\.mp3$/i, ""))}.mp3`, buffer);
  return NextResponse.json({ filePath, name: file.name });
}
