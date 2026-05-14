import { writeFile } from "node:fs/promises";
import { storagePath } from "./storage";

export type CaptionChunk = {
  index: number;
  start: number;
  end: number;
  text: string;
};

export function splitScriptIntoCaptionChunks(script: string, durationSeconds = 30): CaptionChunk[] {
  const words = script.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return [];

  const chunkSize = 3;
  const chunks: string[][] = [];
  for (let index = 0; index < words.length; index += chunkSize) {
    chunks.push(words.slice(index, index + chunkSize));
  }

  const totalWeight = words.reduce((sum, word) => sum + Math.max(1, word.replace(/[^\w]/g, "").length), 0);
  const secondsPerWeight = durationSeconds / totalWeight;
  let cursor = 0;

  return chunks.map((chunkWords, index) => {
    const weight = chunkWords.reduce((sum, word) => sum + Math.max(1, word.replace(/[^\w]/g, "").length), 0);
    const start = cursor;
    const end = Math.min(durationSeconds, start + weight * secondsPerWeight);
    cursor = end;
    return {
      index: index + 1,
      start,
      end: Math.max(end, start + 0.45),
      text: chunkWords.join(" ")
    };
  });
}

function srtTime(seconds: number) {
  const ms = Math.floor((seconds % 1) * 1000);
  const total = Math.floor(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function assTime(seconds: number) {
  const cs = Math.floor((seconds % 1) * 100);
  const total = Math.floor(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function createSrtFile(chunks: CaptionChunk[]) {
  return chunks
    .map((chunk) => `${chunk.index}\n${srtTime(chunk.start)} --> ${srtTime(chunk.end)}\n${chunk.text}\n`)
    .join("\n");
}

const styles: Record<string, string> = {
  "Bold Stroke": "Style: Default,Arial,66,&H00FFFFFF,&H008C8C8C,&H00000000,&HCC000000,1,0,0,0,100,100,0,0,1,6,2,2,100,100,245,1",
  "Red Highlight": "Style: Default,Arial,62,&H00FFFFFF,&H002828E8,&H001111D8,&HCC000000,1,0,0,0,100,100,0,0,1,5,3,2,100,100,245,1",
  Sleek: "Style: Default,Arial,58,&H00FFFFFF,&H00A9A9A9,&H00433322,&HAA000000,0,0,0,0,100,100,0,0,1,2,1,2,110,110,265,1",
  Karaoke: "Style: Default,Arial,64,&H00FFFFFF,&H0000FF6D,&H00321A11,&HCC000000,1,0,0,0,100,100,0,0,1,4,2,2,100,100,245,1"
};

function escapeAssText(text: string) {
  return text.replace(/[{}]/g, "").replace(/\n/g, " ");
}

function createKaraokeText(chunk: CaptionChunk) {
  const words = chunk.text.split(/\s+/).filter(Boolean);
  const durationCentiseconds = Math.max(12, Math.round((chunk.end - chunk.start) * 100));
  const totalWeight = words.reduce((sum, word) => sum + Math.max(1, word.replace(/[^\w]/g, "").length), 0);
  let used = 0;

  return words
    .map((word, index) => {
      const isLast = index === words.length - 1;
      const weight = Math.max(1, word.replace(/[^\w]/g, "").length);
      const centiseconds = isLast ? Math.max(8, durationCentiseconds - used) : Math.max(8, Math.round((durationCentiseconds * weight) / totalWeight));
      used += centiseconds;
      const lineBreak = words.length === 3 && index === 1 ? "\\N" : " ";
      return `{\\k${centiseconds}}${escapeAssText(word)}${isLast ? "" : lineBreak}`;
    })
    .join("");
}

export function createAssFile(chunks: CaptionChunk[], style = "Bold Stroke") {
  const selected = styles[style] ?? styles.Sleek;
  const events = chunks
    .map((chunk) => `Dialogue: 0,${assTime(chunk.start)},${assTime(chunk.end)},Default,,0,0,0,,${createKaraokeText(chunk)}`)
    .join("\n");
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
${selected}

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
${events}
`;
}

export async function writeCaptionFiles(videoId: string, script: string, durationSeconds: number, style: string) {
  const chunks = splitScriptIntoCaptionChunks(script, durationSeconds);
  const assPath = storagePath("captions", `${videoId}.ass`);
  const srtPath = storagePath("captions", `${videoId}.srt`);
  await Promise.all([writeFile(assPath, createAssFile(chunks, style)), writeFile(srtPath, createSrtFile(chunks))]);
  return { assPath, srtPath, chunks };
}
