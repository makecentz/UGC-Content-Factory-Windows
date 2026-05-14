import { execFile } from "node:child_process";
import path from "node:path";
import { transcribeAudioFile } from "@/lib/openai";
import { safeFileName, storagePath } from "@/lib/storage";
import { mediaToolMissingMessage, resolveMediaToolPath } from "@/lib/media-tools";

function ytDlpPath() {
  return resolveMediaToolPath("yt-dlp", process.env.YT_DLP_PATH);
}

function run(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    execFile(command, args, { maxBuffer: 1024 * 1024 * 8 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

export async function transcribeYouTubeUrl(url: string, projectId: string) {
  if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
    throw new Error("Paste a valid YouTube URL.");
  }

  const baseName = `${safeFileName(projectId)}-source`;
  const outputTemplate = storagePath("kids/sources", `${baseName}.%(ext)s`);
  try {
    await run(ytDlpPath(), ["--extract-audio", "--audio-format", "mp3", "--audio-quality", "0", "-o", outputTemplate, url]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not download YouTube audio. ${mediaToolMissingMessage("yt-dlp")} ${message}`);
  }

  return transcribeAudioFile(path.join(storagePath("kids/sources"), `${baseName}.mp3`));
}
