import { createLocalComfyWanProvider } from "./local-comfyui-wan-provider";
import type { VideoProvider } from "./video-provider";

export function getVideoProvider(provider?: string | null): VideoProvider {
  switch ((provider || process.env.DEFAULT_VIDEO_PROVIDER || "local-comfyui-wan22").toLowerCase()) {
    case "comfy-cloud":
    case "comfycloud":
      return createLocalComfyWanProvider("wan22");
    case "comfy-local":
    case "local-comfy":
    case "local-comfyui":
    case "local-wan":
    case "local-wan22":
    case "wan22":
      return createLocalComfyWanProvider("wan22");
    case "local-wan21":
    case "wan21":
      return createLocalComfyWanProvider("wan21");
    case "local-comfyui-wan21":
      return createLocalComfyWanProvider("wan21");
    case "local-comfyui-wan22":
      return createLocalComfyWanProvider("wan22");
    default:
      return createLocalComfyWanProvider("wan22");
  }
}
