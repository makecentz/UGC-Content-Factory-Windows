import { mkdir } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import type { GenerateSceneClipInput, SceneClipStatus, VideoProvider } from "./video-provider";

type StoredOperation = {
  operation: any;
  video?: any;
};

const operations = new Map<string, StoredOperation>();

function apiKey() {
  return process.env.VEO_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

function client() {
  const key = apiKey();
  if (!key) {
    throw new Error("VEO_API_KEY is missing. Add it to .env.local, then restart the dev server.");
  }
  return new GoogleGenAI({ apiKey: key });
}

function normalizeDuration(duration: number) {
  if (duration <= 4) return 4;
  if (duration <= 6) return 6;
  return 8;
}

function scenePrompt(input: GenerateSceneClipInput) {
  const orientation = input.aspectRatio === "16:9" ? "landscape 16:9 YouTube" : "portrait 9:16 story";
  return `${input.prompt}

Scene narration context: "${input.narration}"
Generate ${orientation} visuals only. No visible text, no captions, no subtitles, no logos. Do not attempt lip sync.`;
}

export const veoProvider: VideoProvider = {
  name: "veo",
  async generateSceneClip(input: GenerateSceneClipInput) {
    const ai = client();
    const model = process.env.VEO_MODEL || "veo-3.1-generate-preview";
    const operation = await ai.models.generateVideos({
      model,
      prompt: scenePrompt(input).slice(0, 3800),
      config: {
        aspectRatio: input.aspectRatio,
        durationSeconds: normalizeDuration(input.duration),
        resolution: "720p"
      } as any
    } as any);
    const jobId = operation.name || `veo-${input.sceneId}`;
    operations.set(jobId, { operation });
    return { jobId };
  },
  async getSceneClipStatus(jobId: string): Promise<SceneClipStatus> {
    const stored = operations.get(jobId);
    if (!stored) return { status: "failed", errorMessage: "Veo operation was not found in local memory. Regenerate the scene." };

    const ai = client();
    const operation = await ai.operations.getVideosOperation({ operation: stored.operation } as any);
    stored.operation = operation;
    operations.set(jobId, stored);

    if (!operation.done) return { status: "generating", progress: 40 };

    const response = operation.response as any;
    const video =
      response?.generatedVideos?.[0]?.video ||
      response?.generated_videos?.[0]?.video ||
      response?.generateVideoResponse?.generatedSamples?.[0]?.video;

    if (!video) {
      return {
        status: "failed",
        errorMessage: "Veo finished but did not return a downloadable video. Check Google API billing/access and safety filters."
      };
    }

    stored.video = video;
    operations.set(jobId, stored);
    return { status: "ready", progress: 100, downloadUrl: video.uri || video.name };
  },
  async downloadSceneClip(jobId: string, outputPath: string) {
    const stored = operations.get(jobId);
    if (!stored?.video) throw new Error("Veo clip is not ready to download yet.");

    await mkdir(path.dirname(outputPath), { recursive: true });
    const ai = client();

    if (stored.video.uri) {
      const response = await fetch(stored.video.uri, {
        headers: { "x-goog-api-key": apiKey() || "" }
      });
      if (!response.ok) {
        throw new Error(`Veo download failed: ${response.status} ${await response.text()}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      await import("node:fs/promises").then((fs) => fs.writeFile(outputPath, bytes));
      return outputPath;
    }

    await ai.files.download({
      file: stored.video,
      downloadPath: outputPath
    } as any);
    return outputPath;
  }
};
