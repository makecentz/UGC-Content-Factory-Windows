import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildYoutubeAuthUrl } from "@/lib/youtube/publisher";

export async function GET(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const returnTo = request.nextUrl.searchParams.get("returnTo") || "/kids";
    const nonce = randomBytes(16).toString("hex");
    const state = Buffer.from(JSON.stringify({ nonce, returnTo })).toString("base64url");
    const response = NextResponse.redirect(buildYoutubeAuthUrl({ origin, state }));
    response.cookies.set("youtube_oauth_state", nonce, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/"
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
