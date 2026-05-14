import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type StorageBucket =
  | "exports"
  | "voiceovers"
  | "music"
  | "backgrounds"
  | "captions"
  | "scenes"
  | "storyboards"
  | "providers"
  | "watermarks"
  | "temp"
  | "ugc"
  | "ugc/products"
  | "ugc/creators"
  | "ugc/scenes"
  | "ugc/voiceovers"
  | "ugc/captions"
  | "ugc/exports"
  | "kids"
  | "kids/characters"
  | "kids/sources"
  | "kids/images"
  | "kids/scenes"
  | "kids/bumpers"
  | "kids/thumbnails"
  | "kids/voiceovers"
  | "kids/exports"
  | "drama"
  | "drama/scenes"
  | "drama/voiceovers"
  | "drama/exports"
  | "motivational"
  | "motivational/sources"
  | "motivational/scenes"
  | "motivational/voiceovers"
  | "motivational/captions"
  | "motivational/watermarks"
  | "motivational/exports"
  | "comfyui"
  | "comfyui/workflows"
  | "comfyui/inputs"
  | "comfyui/outputs"
  | "comfyui/temp"
  | "scenes/local-wan"
  | "scenes/comfy-cloud";

export function storageRoot() {
  return path.resolve(process.cwd(), process.env.REELPILOT_STORAGE_PATH ?? "./storage");
}

export function storagePath(bucket: StorageBucket, fileName = "") {
  const exportRoot = process.env.REELPILOT_EXPORTS_PATH;
  if (exportRoot) {
    if (bucket === "exports") return path.join(exportRoot, fileName);
    if (bucket === "kids/exports") return path.join(exportRoot, "kids", fileName);
    if (bucket === "ugc/exports") return path.join(exportRoot, "ugc", fileName);
    if (bucket === "drama/exports") return path.join(exportRoot, "drama", fileName);
    if (bucket === "motivational/exports") return path.join(exportRoot, "motivational", fileName);
  }
  return path.join(storageRoot(), bucket, fileName);
}

export async function ensureStorage() {
  await Promise.all(
    (
      [
        "exports",
        "voiceovers",
        "music",
        "backgrounds",
        "captions",
        "scenes",
        "storyboards",
        "providers",
        "watermarks",
        "temp",
        "ugc",
        "ugc/products",
        "ugc/creators",
        "ugc/scenes",
        "ugc/voiceovers",
        "ugc/captions",
        "ugc/exports",
        "kids",
        "kids/characters",
        "kids/sources",
        "kids/images",
        "kids/scenes",
        "kids/bumpers",
        "kids/thumbnails",
        "kids/voiceovers",
        "kids/exports",
        "drama",
        "drama/scenes",
        "drama/voiceovers",
        "drama/exports",
        "motivational",
        "motivational/sources",
        "motivational/scenes",
        "motivational/voiceovers",
        "motivational/captions",
        "motivational/watermarks",
        "motivational/exports",
        "comfyui",
        "comfyui/workflows",
        "comfyui/inputs",
        "comfyui/outputs",
        "comfyui/temp",
        "scenes/local-wan",
        "scenes/comfy-cloud"
      ] as StorageBucket[]
    ).map((bucket) => mkdir(storagePath(bucket), { recursive: true }))
  );
}

export function safeFileName(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export async function saveBuffer(bucket: StorageBucket, fileName: string, data: Buffer | Uint8Array) {
  await ensureStorage();
  const target = storagePath(bucket, fileName);
  await writeFile(target, data);
  return target;
}

export async function clearTempFiles() {
  await ensureStorage();
  const files = await readdir(storagePath("temp"), { withFileTypes: true });
  await Promise.all(files.map((file) => rm(path.join(storagePath("temp"), file.name), { recursive: true, force: true })));
}

export function toPublicFileUrl(filePath?: string | null) {
  if (!filePath) return null;
  return `/api/videos/file?path=${encodeURIComponent(filePath)}`;
}
