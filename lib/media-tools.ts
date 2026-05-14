import { existsSync } from "node:fs";
import path from "node:path";

type ToolName = "ffmpeg" | "ffprobe" | "yt-dlp";

function executableName(tool: ToolName) {
  return process.platform === "win32" ? `${tool}.exe` : tool;
}

function platformDir() {
  if (process.platform === "win32") return "win";
  if (process.platform === "darwin") return "mac";
  return "linux";
}

function candidateRoots() {
  return [
    process.env.REELPILOT_RESOURCES_PATH ? path.join(process.env.REELPILOT_RESOURCES_PATH, "vendor") : "",
    process.env.REELPILOT_RESOURCES_PATH ? path.join(process.env.REELPILOT_RESOURCES_PATH, "app", "vendor") : "",
    process.env.REELPILOT_APP_ROOT ? path.join(process.env.REELPILOT_APP_ROOT, "vendor") : "",
    path.join(process.cwd(), "vendor")
  ].filter(Boolean);
}

export function resolveMediaToolPath(tool: ToolName, configured?: string | null) {
  if (configured && existsSync(configured)) return configured;
  const fileName = executableName(tool);
  const dir = platformDir();
  for (const root of candidateRoots()) {
    const candidate = path.join(root, dir, fileName);
    if (existsSync(candidate)) return candidate;
  }
  return configured || tool;
}

export function mediaToolMissingMessage(tool: ToolName) {
  const windowsPath = `vendor\\win\\${executableName(tool)}`;
  if (process.platform === "win32") {
    return `${tool} was not found. The Windows installer should bundle it automatically. Re-run npm run electron:prepare-win-tools before packaging, or reinstall ReelPilot from the latest installer. Expected bundled path: ${windowsPath}.`;
  }
  if (process.platform === "darwin") {
    return `${tool} was not found. Packaged Windows builds bundle media tools automatically. For local macOS development, install it with Homebrew or run npm run electron:prepare-mac-tools before packaging.`;
  }
  return `${tool} was not found. Install it on PATH or place it in vendor/${platformDir()}/${executableName(tool)}.`;
}
