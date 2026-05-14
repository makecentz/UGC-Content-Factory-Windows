import { getStylePreset } from "./style-presets";

export type StyleLock = {
  aspectRatio: "vertical 9:16";
  visualStyle: string;
  lighting: string;
  colorPalette: string;
  cameraMovement: string;
  motionStyle: string;
  negativePromptRules: string[];
};

export function getStyleLock(styleName?: string | null): StyleLock {
  const preset = getStylePreset(styleName);
  return {
    aspectRatio: "vertical 9:16",
    visualStyle: preset.overall,
    lighting: preset.lighting,
    colorPalette: preset.colorPalette,
    cameraMovement: preset.camera,
    motionStyle: preset.motion,
    negativePromptRules: [
      "Do not add captions or text inside the generated clip. Captions are added later by ReelPilot.",
      "No subtitles, no logos, no watermarks, no UI, no brand names.",
      "No lip-sync dependency; visuals illustrate narration only.",
      "Keep composition readable on a vertical mobile screen."
    ]
  };
}

export function styleLockPrompt(styleLock: StyleLock) {
  return `Style lock: aspect ratio ${styleLock.aspectRatio}; visual style ${styleLock.visualStyle}; lighting ${styleLock.lighting}; color palette ${styleLock.colorPalette}; camera movement ${styleLock.cameraMovement}; motion style ${styleLock.motionStyle}. Negative rules: ${styleLock.negativePromptRules.join(" ")}`;
}
