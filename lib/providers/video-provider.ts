export type GenerateSceneClipInput = {
  prompt: string;
  duration: number;
  aspectRatio: "9:16" | "16:9";
  style: string;
  referenceImages?: string[];
  seed?: string;
  mode?: "text-to-video" | "image-to-video" | "custom-workflow";
  projectType?: "story" | "ugc" | "kids-story" | "drama-short" | "motivational-short" | "test";
  localVideoSettings?: {
    width?: number;
    height?: number;
    frames?: number;
    fps?: number;
    steps?: number;
    guidance?: number;
  };
  sceneId: string;
  sceneNumber: number;
  narration: string;
};

export type SceneClipJob = {
  jobId: string;
};

export type SceneClipStatus = {
  status: "pending" | "generating" | "ready" | "failed";
  progress?: number;
  downloadUrl?: string;
  errorMessage?: string;
};

export interface VideoProvider {
  name: string;
  generateSceneClip(input: GenerateSceneClipInput): Promise<SceneClipJob>;
  getSceneClipStatus(jobId: string): Promise<SceneClipStatus>;
  downloadSceneClip(jobId: string, outputPath: string): Promise<string>;
}
