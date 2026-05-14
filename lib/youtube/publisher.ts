import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_UPLOAD_API = "https://www.googleapis.com/upload/youtube/v3";
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly"
];

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type ChannelListResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
      };
    };
  }>;
  error?: { message?: string };
};

type VideoInsertResponse = {
  id?: string;
  error?: { message?: string };
};

function getClientId() {
  return process.env.YOUTUBE_CLIENT_ID || "";
}

function getClientSecret() {
  return process.env.YOUTUBE_CLIENT_SECRET || "";
}

export function getYoutubeRedirectUri(origin: string) {
  return process.env.YOUTUBE_REDIRECT_URI || `${origin}/api/youtube/oauth/callback`;
}

function assertYoutubeOAuthConfigured() {
  if (!getClientId() || !getClientSecret()) {
    throw new Error("YouTube is not configured. Add YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET to .env.local, then restart the app.");
  }
}

export function buildYoutubeAuthUrl(input: { origin: string; state: string }) {
  assertYoutubeOAuthConfigured();
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", getClientId());
  url.searchParams.set("redirect_uri", getYoutubeRedirectUri(input.origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", input.state);
  return url.toString();
}

async function parseGoogleResponse<T>(response: Response) {
  const text = await response.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error_description" in data
        ? String((data as GoogleTokenResponse).error_description)
        : data && typeof data === "object" && "error" in data && typeof (data as any).error?.message === "string"
          ? (data as any).error.message
          : text || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return data as T;
}

export async function exchangeYoutubeCode(input: { code: string; origin: string }) {
  assertYoutubeOAuthConfigured();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getYoutubeRedirectUri(input.origin),
      grant_type: "authorization_code"
    })
  });
  const token = await parseGoogleResponse<GoogleTokenResponse>(response);
  if (!token.access_token) throw new Error(token.error_description || token.error || "Google did not return a YouTube access token.");
  return token;
}

async function refreshYoutubeAccessToken(connectionId: string) {
  assertYoutubeOAuthConfigured();
  const connection = await prisma.youTubeChannelConnection.findUnique({ where: { id: connectionId } });
  if (!connection?.refreshToken) throw new Error("This YouTube channel needs to be reconnected before uploading.");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token"
    })
  });
  const token = await parseGoogleResponse<GoogleTokenResponse>(response);
  if (!token.access_token) throw new Error(token.error_description || token.error || "Google did not return a refreshed YouTube token.");

  const updated = await prisma.youTubeChannelConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: token.access_token,
      tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      scope: token.scope || connection.scope
    }
  });
  return updated.accessToken;
}

async function getFreshAccessToken(connectionId: string) {
  const connection = await prisma.youTubeChannelConnection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new Error("Selected YouTube channel is no longer saved.");
  const expiresAt = connection.tokenExpiresAt?.getTime() || 0;
  if (expiresAt && expiresAt - Date.now() < 60_000) return refreshYoutubeAccessToken(connection.id);
  return connection.accessToken;
}

export async function saveYoutubeChannelsFromToken(token: GoogleTokenResponse) {
  if (!token.access_token) throw new Error("Missing YouTube access token.");
  const response = await fetch(`${YOUTUBE_API}/channels?part=snippet&mine=true&maxResults=50`, {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  const data = await parseGoogleResponse<ChannelListResponse>(response);
  const channels = data.items || [];
  if (channels.length === 0) throw new Error("No YouTube channel was found for this Google account.");

  const hasSelected = await prisma.youTubeChannelConnection.findFirst({ where: { selected: true } });
  const saved = [];
  for (let index = 0; index < channels.length; index += 1) {
    const channel = channels[index];
    if (!channel.id) continue;
    const existing = await prisma.youTubeChannelConnection.findUnique({ where: { channelId: channel.id } });
    const selected = !hasSelected && index === 0;
    const savedConnection = await prisma.youTubeChannelConnection.upsert({
      where: { channelId: channel.id },
      create: {
        channelId: channel.id,
        channelTitle: channel.snippet?.title || "YouTube Channel",
        channelThumbnailUrl: channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url || channel.snippet?.thumbnails?.high?.url || null,
        accessToken: token.access_token,
        refreshToken: token.refresh_token || null,
        tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
        scope: token.scope || SCOPES.join(" "),
        selected
      },
      update: {
        channelTitle: channel.snippet?.title || existing?.channelTitle || "YouTube Channel",
        channelThumbnailUrl: channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url || channel.snippet?.thumbnails?.high?.url || existing?.channelThumbnailUrl || null,
        accessToken: token.access_token,
        refreshToken: token.refresh_token || existing?.refreshToken || null,
        tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : existing?.tokenExpiresAt || null,
        scope: token.scope || existing?.scope || SCOPES.join(" ")
      }
    });
    saved.push(savedConnection);
  }
  return saved;
}

function parseTags(tags?: string | null) {
  return (tags || "")
    .split(/[,#\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

async function prepareThumbnailForUpload(filePath: string, aspectRatio?: string | null) {
  const ratio = aspectRatio === "9:16" ? "9:16" : "16:9";
  const target = ratio === "9:16" ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
  const original = await readFile(filePath);
  if (original.length <= 1_950_000 && contentTypeFor(filePath) === "image/jpeg") {
    return { bytes: original, contentType: "image/jpeg" };
  }

  for (const quality of [88, 82, 76, 70, 64, 58, 52]) {
    const bytes = await sharp(original)
      .resize(target.width, target.height, { fit: "cover", position: "center" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (bytes.length <= 1_950_000) return { bytes, contentType: "image/jpeg" };
  }

  const bytes = await sharp(original)
    .resize(Math.round(target.width * 0.8), Math.round(target.height * 0.8), { fit: "cover", position: "center" })
    .jpeg({ quality: 50, mozjpeg: true })
    .toBuffer();
  if (bytes.length > 2_097_152) {
    throw new Error("Thumbnail is still too large after compression. Create the YouTube package again, then retry upload.");
  }
  return { bytes, contentType: "image/jpeg" };
}

export async function uploadKidsStoryToYoutube(projectId: string, connectionId?: string) {
  const project = await prisma.kidsStoryProject.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Kids story project not found.");
  if (!project.finalVideoPath || !existsSync(project.finalVideoPath)) throw new Error("Render the final video before uploading to YouTube.");
  if (!project.youtubeDescription || !project.youtubeTags || !project.thumbnailPath) {
    throw new Error("Create the YouTube package before uploading so the description, tags, and thumbnail are ready.");
  }

  const connection = connectionId
    ? await prisma.youTubeChannelConnection.findUnique({ where: { id: connectionId } })
    : await prisma.youTubeChannelConnection.findFirst({ where: { selected: true } }) ||
      await prisma.youTubeChannelConnection.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!connection) throw new Error("Connect a YouTube channel before uploading.");

  await prisma.kidsStoryProject.update({
    where: { id: project.id },
    data: { youtubeUploadStatus: "uploading", youtubeChannelId: connection.channelId, errorMessage: null }
  });

  const accessToken = await getFreshAccessToken(connection.id);
  let uploadedVideoId = project.youtubeVideoId || "";

  if (!uploadedVideoId) {
    const videoSize = (await stat(project.finalVideoPath)).size;
    const metadata = {
      snippet: {
        title: project.title.slice(0, 100),
        description: project.youtubeDescription,
        tags: parseTags(project.youtubeTags),
        categoryId: "1"
      },
      status: {
        privacyStatus: process.env.YOUTUBE_UPLOAD_PRIVACY || "private",
        selfDeclaredMadeForKids: true,
        containsSyntheticMedia: true
      }
    };

    const initResponse = await fetch(`${YOUTUBE_UPLOAD_API}/videos?uploadType=resumable&part=snippet,status&notifySubscribers=false`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(videoSize)
      },
      body: JSON.stringify(metadata)
    });
    if (!initResponse.ok) {
      const text = await initResponse.text();
      throw new Error(`YouTube upload could not start: ${text || initResponse.statusText}`);
    }
    const uploadUrl = initResponse.headers.get("location");
    if (!uploadUrl) throw new Error("YouTube did not return an upload session URL.");

    const videoBytes = await readFile(project.finalVideoPath);
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "video/mp4",
        "Content-Length": String(videoBytes.length)
      },
      body: videoBytes
    });
    const uploaded = await parseGoogleResponse<VideoInsertResponse>(uploadResponse);
    if (!uploaded.id) throw new Error(uploaded.error?.message || "YouTube did not return a video id.");
    uploadedVideoId = uploaded.id;

    await prisma.kidsStoryProject.update({
      where: { id: project.id },
      data: {
        youtubeChannelId: connection.channelId,
        youtubeVideoId: uploadedVideoId,
        youtubeVideoUrl: `https://www.youtube.com/watch?v=${uploadedVideoId}`,
        youtubeUploadStatus: "thumbnail_pending"
      }
    });
  }

	  if (project.thumbnailPath && existsSync(project.thumbnailPath)) {
	    const thumbnail = await prepareThumbnailForUpload(project.thumbnailPath, project.aspectRatio);
	    const thumbnailResponse = await fetch(`${YOUTUBE_UPLOAD_API}/thumbnails/set?videoId=${encodeURIComponent(uploadedVideoId)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": thumbnail.contentType,
        "Content-Length": String(thumbnail.bytes.length)
      },
      body: thumbnail.bytes as unknown as BodyInit
    });
    if (!thumbnailResponse.ok) {
      const text = await thumbnailResponse.text();
      throw new Error(`Video uploaded, but thumbnail upload failed: ${text || thumbnailResponse.statusText}`);
    }
  }

  return prisma.kidsStoryProject.update({
    where: { id: project.id },
    data: {
      youtubeChannelId: connection.channelId,
      youtubeVideoId: uploadedVideoId,
      youtubeVideoUrl: `https://www.youtube.com/watch?v=${uploadedVideoId}`,
      youtubeUploadStatus: "uploaded",
      youtubeUploadedAt: new Date(),
      errorMessage: null
    }
  });
}
