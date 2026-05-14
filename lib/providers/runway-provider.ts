import type { VideoProvider } from "./video-provider";

export const runwayProvider: VideoProvider = {
  name: "runway",
  async generateSceneClip() {
    throw new Error("Runway provider is scaffolded. Add RUNWAY_API_KEY and implement the provider API call.");
  },
  async getSceneClipStatus() {
    throw new Error("Runway provider polling is not implemented yet.");
  },
  async downloadSceneClip() {
    throw new Error("Runway provider download is not implemented yet.");
  }
};
