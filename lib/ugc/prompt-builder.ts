import type { UGCProject, UGCScene } from "@prisma/client";
import { sanitizePrompt } from "../prompt-sanitizer";

function parseJson<T>(value?: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function buildUGCScenePrompt(scene: UGCScene, project: UGCProject) {
  const creatorProfile = parseJson<Record<string, unknown>>(project.creatorProfileJson);
  const productProfile = parseJson<Record<string, unknown>>(project.productProfileJson);
  const creator = creatorProfile ? JSON.stringify(creatorProfile) : "creator matching uploaded reference image";
  const product = productProfile ? JSON.stringify(productProfile) : `${project.productName}, ${project.productDescription}`;
  const base = scene.editedPrompt || scene.prompt;

  return sanitizePrompt(`Vertical 9:16 UGC ad style video for ${project.platform}.
UGC style: ${project.style}. Tone: ${project.tone}.
Scene type: ${scene.shotType || "UGC ad scene"}.
Narration context: "${scene.narration}"
Visual action: ${scene.visualDescription || base}
Camera: ${scene.camera || "handheld creator-style camera"}.
Mood: ${scene.mood || project.tone}.

Creator reference profile: ${creator}
Product reference profile: ${product}

Rules:
- Product must be clearly visible when appropriate.
- Creator should hold, use, point to, or naturally interact with the product when the shot type calls for it.
- Keep the creator visually consistent with the uploaded creator reference.
- Keep product packaging consistent with the uploaded product reference.
- Realistic user-generated content framing, natural lighting, mobile-first composition.
- No captions, subtitles, text, brand overlays, labels, or logos baked into the generated clip. ReelPilot adds captions later.

Scene prompt: ${base}`);
}
