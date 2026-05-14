export type StylePreset = {
  name: string;
  overall: string;
  lighting: string;
  motion: string;
  camera: string;
  colorPalette: string;
  promptSuffix: string;
};

export const stylePresets: Record<string, StylePreset> = {
  "Cinematic Realism": {
    name: "Cinematic Realism",
    overall: "cinematic realistic story scene",
    lighting: "natural dramatic lighting with motivated highlights",
    motion: "subtle realistic movement and slow atmospheric motion",
    camera: "slow push-in, handheld realism, shallow depth of field",
    colorPalette: "rich contrast, natural skin tones, restrained cinematic colors",
    promptSuffix: "vertical 9:16 composition, cinematic realism, high detail, realistic environments, no text, no captions, no logos"
  },
  Comic: {
    name: "Comic",
    overall: "dynamic comic book story illustration in motion",
    lighting: "bold cel-shaded lighting",
    motion: "panel-like motion, expressive action, dramatic poses",
    camera: "dynamic framing, slight parallax, comic panel energy",
    colorPalette: "bright primaries, ink shadows, high contrast",
    promptSuffix: "vertical 9:16 animated comic style, clean ink outlines, high energy, no text, no speech bubbles, no logos"
  },
  "Creepy Comic": {
    name: "Creepy Comic",
    overall: "eerie illustrated horror comic scene",
    lighting: "low key lighting with ominous highlights",
    motion: "slow unsettling motion, drifting shadows",
    camera: "creeping push-in, tilted framing, suspenseful reveals",
    colorPalette: "deep reds, dirty purples, black ink shadows",
    promptSuffix: "vertical 9:16 creepy comic style, tense atmosphere, stylized horror, no text, no gore, no logos"
  },
  "Modern Cartoon": {
    name: "Modern Cartoon",
    overall: "colorful modern animated story style with expressive characters",
    lighting: "storybook lighting, soft clean highlights",
    motion: "smooth motion, expressive character animation",
    camera: "dynamic framing, gentle push-in, mobile-first composition",
    colorPalette: "colorful, polished, clean outlines",
    promptSuffix: "vertical 9:16 animated story scene, modern cartoon style, clean outlines, storybook lighting, high detail, no text, no logos"
  },
  "3D Animation": {
    name: "3D Animation",
    overall: "polished stylized 3D animated scene",
    lighting: "soft cinematic global illumination",
    motion: "smooth 3D camera motion and readable character action",
    camera: "Pixar-like framing, subtle dolly movement",
    colorPalette: "vibrant but balanced cinematic colors",
    promptSuffix: "vertical 9:16 stylized 3D animation, expressive characters, clean render, no text, no logos"
  },
  Documentary: {
    name: "Documentary",
    overall: "documentary reenactment and archival-inspired visual scene",
    lighting: "natural documentary lighting",
    motion: "slow observational movement",
    camera: "documentary camera, composed realistic framing",
    colorPalette: "muted blues, warm archival tones, realistic texture",
    promptSuffix: "vertical 9:16 documentary reenactment, realistic setting, authentic details, no text overlays, no logos"
  },
  "Dark Thriller": {
    name: "Dark Thriller",
    overall: "dark cinematic thriller story scene",
    lighting: "moody low-key lighting, sharp rim lights",
    motion: "tense slow motion, drifting haze",
    camera: "slow push-in, suspenseful close framing",
    colorPalette: "black, deep blue, red accents, high contrast",
    promptSuffix: "vertical 9:16 dark thriller cinematic style, ominous atmosphere, no text, no gore, no logos"
  },
  "Luxury Motivation": {
    name: "Luxury Motivation",
    overall: "premium aspirational cinematic motivation scene",
    lighting: "golden hour and glossy luxury lighting",
    motion: "smooth elegant camera motion",
    camera: "sleek dolly shot, premium commercial framing",
    colorPalette: "black, gold, cream, polished highlights",
    promptSuffix: "vertical 9:16 luxury cinematic style, premium detail, aspirational mood, no text, no logos"
  }
};

export function getStylePreset(name?: string | null) {
  return stylePresets[name ?? ""] ?? stylePresets["Cinematic Realism"];
}
