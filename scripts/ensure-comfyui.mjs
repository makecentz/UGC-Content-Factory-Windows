import { appendFileSync, closeSync, existsSync, openSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const comfyRoot = process.env.COMFYUI_PATH || "/Users/makecentz/ComfyUI";
const host = process.env.COMFYUI_HOST || "127.0.0.1";
const port = Number(process.env.COMFYUI_PORT || 8188);
const url = `http://${host}:${port}`;
const pythonPath = process.env.COMFYUI_PYTHON || path.join(comfyRoot, "venv", "bin", "python");
const mainPath = path.join(comfyRoot, "main.py");
const logDir = path.join(process.cwd(), "storage", "logs");
const logPath = path.join(logDir, "comfyui.log");

async function isRunning() {
  try {
    const response = await fetch(`${url}/system_stats`, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitUntilReady(seconds = 20) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (await isRunning()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

if (await isRunning()) {
  console.log(`[ReelPilot] ComfyUI already running at ${url}`);
  process.exit(0);
}

if (!existsSync(mainPath) || !existsSync(pythonPath)) {
  console.warn(`[ReelPilot] ComfyUI auto-start skipped. Expected ${mainPath} and ${pythonPath}.`);
  process.exit(0);
}

await mkdir(logDir, { recursive: true });
appendFileSync(logPath, `\n\n[${new Date().toISOString()}] Starting ComfyUI at ${url}\n`);
const logFd = openSync(logPath, "a");

const child = spawn(pythonPath, [mainPath, "--listen", host, "--port", String(port)], {
  cwd: comfyRoot,
  detached: true,
  stdio: ["ignore", logFd, logFd]
});

child.unref();
closeSync(logFd);

console.log(`[ReelPilot] Starting ComfyUI at ${url}. Logs: ${logPath}`);
if (await waitUntilReady()) {
  console.log(`[ReelPilot] ComfyUI is ready at ${url}`);
} else {
  console.warn(`[ReelPilot] ComfyUI is still starting. Check ${logPath} if it does not appear at ${url}.`);
}
