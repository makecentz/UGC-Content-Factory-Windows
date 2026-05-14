import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { storagePath } from "./storage";

type BackgroundDefinition = {
  fileName: string;
  name: string;
  colors: [string, string, string];
  accent: string;
};

const backgrounds: BackgroundDefinition[] = [
  {
    fileName: "purple-cinematic-gradient.ppm",
    name: "purple cinematic gradient",
    colors: ["#160D2B", "#5C1BC9", "#C79CFF"],
    accent: "#FFFFFF"
  },
  {
    fileName: "dark-thriller-gradient.ppm",
    name: "dark thriller gradient",
    colors: ["#050507", "#171321", "#4A0F2E"],
    accent: "#B51D55"
  },
  {
    fileName: "blue-documentary-gradient.ppm",
    name: "blue documentary gradient",
    colors: ["#071526", "#124D7D", "#9DD7FF"],
    accent: "#EAF7FF"
  },
  {
    fileName: "gold-motivation-gradient.ppm",
    name: "gold motivation gradient",
    colors: ["#211406", "#A66813", "#FFE08A"],
    accent: "#FFF5D0"
  },
  {
    fileName: "red-scary-story-gradient.ppm",
    name: "red scary story gradient",
    colors: ["#090405", "#5B060D", "#D02132"],
    accent: "#FF9BA3"
  },
  {
    fileName: "black-gray-luxury-gradient.ppm",
    name: "black gray luxury gradient",
    colors: ["#040405", "#303036", "#B7B7BA"],
    accent: "#F4F4F5"
  }
];

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  return [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16));
}

function makePpmGradient(background: BackgroundDefinition) {
  const width = 1080;
  const height = 1920;
  const [start, middle, end] = background.colors.map(hexToRgb);
  const header = Buffer.from(`P6\n${width} ${height}\n255\n`, "ascii");
  const pixels = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    const t = y / (height - 1);
    const from = t < 0.55 ? start : middle;
    const to = t < 0.55 ? middle : end;
    const local = t < 0.55 ? t / 0.55 : (t - 0.55) / 0.45;
    for (let x = 0; x < width; x += 1) {
      const glow = Math.max(0, 1 - Math.hypot((x - width * 0.68) / width, (y - height * 0.22) / height) * 2.2);
      const offset = (y * width + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        const base = Math.round(from[channel] + (to[channel] - from[channel]) * local);
        pixels[offset + channel] = Math.min(255, Math.round(base + glow * 58));
      }
    }
  }

  return Buffer.concat([header, pixels]);
}

export async function ensureDefaultBackgrounds() {
  const dir = storagePath("backgrounds");
  await mkdir(dir, { recursive: true });

  await Promise.all(
    backgrounds.map(async (background) => {
      const filePath = path.join(dir, background.fileName);
      if (existsSync(filePath)) return;
      await writeFile(filePath, makePpmGradient(background));
    })
  );

  return backgrounds.map((background) => path.join(dir, background.fileName));
}

export async function selectFallbackBackground(artStyle?: string | null, niche?: string | null) {
  await ensureDefaultBackgrounds();
  const key = `${artStyle ?? ""} ${niche ?? ""}`.toLowerCase();

  let fileName = "purple-cinematic-gradient.ppm";
  if (key.includes("thriller") || key.includes("creepy")) fileName = "dark-thriller-gradient.ppm";
  if (key.includes("scary") || key.includes("horror")) fileName = "red-scary-story-gradient.ppm";
  if (key.includes("documentary") || key.includes("history") || key.includes("historical")) fileName = "blue-documentary-gradient.ppm";
  if (key.includes("motivation") || key.includes("money") || key.includes("business")) fileName = "gold-motivation-gradient.ppm";
  if (key.includes("luxury")) fileName = "black-gray-luxury-gradient.ppm";

  return storagePath("backgrounds", fileName);
}
