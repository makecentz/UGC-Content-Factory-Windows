import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const installerNames = [
  "ReelPilot-0.1.0-arm64.pkg",
  "ReelPilot-0.1.0-arm64.dmg",
  "ReelPilot-0.1.0-arm64.zip"
];

async function findInstaller() {
  for (const name of installerNames) {
    const filePath = path.join(process.cwd(), "dist-electron", name);
    try {
      const fileStat = await stat(filePath);
      if (fileStat.isFile()) return { filePath, fileStat, name };
    } catch {
      // Try the next installer format.
    }
  }
  return null;
}

function contentType(name: string) {
  if (name.endsWith(".pkg")) return "application/octet-stream";
  if (name.endsWith(".dmg")) return "application/x-apple-diskimage";
  if (name.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

export async function GET() {
  const installer = await findInstaller();
  if (!installer) {
    return NextResponse.json(
      {
        error: "No Mac installer has been built yet. Run npm run dist:mac, then refresh this page."
      },
      { status: 404 }
    );
  }

  const stream = Readable.toWeb(createReadStream(installer.filePath)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": contentType(installer.name),
      "Content-Length": String(installer.fileStat.size),
      "Content-Disposition": `attachment; filename="${installer.name}"`
    }
  });
}
