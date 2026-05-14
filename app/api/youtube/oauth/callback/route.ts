import { NextRequest, NextResponse } from "next/server";
import { exchangeYoutubeCode, saveYoutubeChannelsFromToken } from "@/lib/youtube/publisher";

function parseState(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { nonce?: string; returnTo?: string };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const returnToFallback = "/kids?youtube=connected";
  try {
    const error = request.nextUrl.searchParams.get("error");
    if (error) throw new Error(error);

    const code = request.nextUrl.searchParams.get("code");
    if (!code) throw new Error("Google did not return an authorization code.");

    const state = parseState(request.nextUrl.searchParams.get("state"));
    const expectedNonce = request.cookies.get("youtube_oauth_state")?.value;
    if (!state?.nonce || !expectedNonce || state.nonce !== expectedNonce) {
      throw new Error("YouTube connection expired. Please try connecting again.");
    }

    const token = await exchangeYoutubeCode({ code, origin: request.nextUrl.origin });
    await saveYoutubeChannelsFromToken(token);

    const returnTo = state.returnTo && state.returnTo.startsWith("/") ? state.returnTo : returnToFallback;
    const redirectUrl = new URL(returnTo, request.nextUrl.origin);
    redirectUrl.searchParams.set("youtube", "connected");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("youtube_oauth_state");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const redirectUrl = new URL("/kids", request.nextUrl.origin);
    redirectUrl.searchParams.set("youtubeError", message);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("youtube_oauth_state");
    return response;
  }
}
