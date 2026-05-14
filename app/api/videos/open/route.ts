import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.path || !existsSync(body.path)) return NextResponse.json({ error: "File not found." }, { status: 404 });
  execFile("open", [body.path]);
  return NextResponse.json({ ok: true });
}
