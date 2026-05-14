const copyrightedOrBrandTerms = [
  "disney",
  "marvel",
  "pixar",
  "star wars",
  "harry potter",
  "batman",
  "spider-man",
  "superman",
  "mickey mouse",
  "nike",
  "apple logo",
  "coca-cola",
  "tesla logo"
];

export function sanitizePrompt(prompt: string) {
  let sanitized = prompt.replace(/\s+/g, " ").trim();

  sanitized = sanitized.replace(/\b(add|show|display|include|write)\s+(on-screen\s+)?(text|captions|subtitles|words|title cards?)\b/gi, "avoid text overlays");
  sanitized = sanitized.replace(/\b(horizontal|landscape|16:9|wide-screen|widescreen)\b/gi, "vertical 9:16");

  for (const term of copyrightedOrBrandTerms) {
    sanitized = sanitized.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "original fictional style");
  }

  const sentences = sanitized.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 4) sanitized = sentences.slice(0, 4).join(" ");

  return `${sanitized} Keep the action simple and scene-specific. Visual storytelling only. No text, captions, logos, or watermarks inside the generated clip.`;
}
