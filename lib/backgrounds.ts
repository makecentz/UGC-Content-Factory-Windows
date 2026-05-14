import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { storagePath } from "./storage";

type BackgroundDefinition = {
  fileName: string;
  name: string;
  colors: [string, string, string];
  accent: string;
};

const backgrounds: BackgroundDefinition[] = [
  {
    fileName: "purple-cinematic-gradient.png",
    name: "purple cinematic gradient",
    colors: ["#160D2B", "#5C1BC9", "#C79CFF"],
    accent: "#FFFFFF"
  },
  {
    fileName: "dark-thriller-gradient.png",
    name: "dark thriller gradient",
    colors: ["#050507", "#171321", "#4A0F2E"],
    accent: "#B51D55"
  },
  {
    fileName: "blue-documentary-gradient.png",
    name: "blue documentary gradient",
    colors: ["#071526", "#124D7D", "#9DD7FF"],
    accent: "#EAF7FF"
  },
  {
    fileName: "gold-motivation-gradient.png",
    name: "gold motivation gradient",
    colors: ["#211406", "#A66813", "#FFE08A"],
    accent: "#FFF5D0"
  },
  {
    fileName: "red-scary-story-gradient.png",
    name: "red scary story gradient",
    colors: ["#090405", "#5B060D", "#D02132"],
    accent: "#FF9BA3"
  },
  {
    fileName: "black-gray-luxury-gradient.png",
    name: "black gray luxury gradient",
    colors: ["#040405", "#303036", "#B7B7BA"],
    accent: "#F4F4F5"
  }
];

function backgroundSvg(background: BackgroundDefinition) {
  const [start, middle, end] = background.colors;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${start}"/>
      <stop offset="0.52" stop-color="${middle}"/>
      <stop offset="1" stop-color="${end}"/>
    </linearGradient>
    <radialGradient id="glow" cx="68%" cy="22%" r="58%">
      <stop offset="0" stop-color="${background.accent}" stop-opacity="0.34"/>
      <stop offset="0.42" stop-color="${background.accent}" stop-opacity="0.12"/>
      <stop offset="1" stop-color="${background.accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grain" width="64" height="64" patternUnits="userSpaceOnUse">
      <rect width="64" height="64" fill="transparent"/>
      <circle cx="9" cy="13" r="1.4" fill="#ffffff" opacity="0.12"/>
      <circle cx="42" cy="27" r="1" fill="#ffffff" opacity="0.08"/>
      <circle cx="28" cy="55" r="1.2" fill="#000000" opacity="0.13"/>
    </pattern>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <rect width="1080" height="1920" fill="url(#glow)"/>
  <path d="M-120 1180 C 190 1000, 410 1320, 690 1120 S 1110 960, 1230 1120 L1230 2020 L-120 2020 Z" fill="#ffffff" opacity="0.07"/>
  <path d="M-80 520 C 180 430, 360 600, 610 505 S 1030 330, 1190 450" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="5"/>
  <rect width="1080" height="1920" fill="url(#grain)"/>
  <rect x="72" y="72" width="936" height="1776" rx="48" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>
</svg>`;
}

export async function ensureDefaultBackgrounds() {
  const dir = storagePath("backgrounds");
  await mkdir(dir, { recursive: true });

  await Promise.all(
    backgrounds.map(async (background) => {
      const filePath = path.join(dir, background.fileName);
      if (existsSync(filePath)) return;
      await sharp(Buffer.from(backgroundSvg(background))).png().toFile(filePath);
    })
  );

  return backgrounds.map((background) => path.join(dir, background.fileName));
}

export async function selectFallbackBackground(artStyle?: string | null, niche?: string | null) {
  await ensureDefaultBackgrounds();
  const key = `${artStyle ?? ""} ${niche ?? ""}`.toLowerCase();

  let fileName = "purple-cinematic-gradient.png";
  if (key.includes("thriller") || key.includes("creepy")) fileName = "dark-thriller-gradient.png";
  if (key.includes("scary") || key.includes("horror")) fileName = "red-scary-story-gradient.png";
  if (key.includes("documentary") || key.includes("history") || key.includes("historical")) fileName = "blue-documentary-gradient.png";
  if (key.includes("motivation") || key.includes("money") || key.includes("business")) fileName = "gold-motivation-gradient.png";
  if (key.includes("luxury")) fileName = "black-gray-luxury-gradient.png";

  return storagePath("backgrounds", fileName);
}
