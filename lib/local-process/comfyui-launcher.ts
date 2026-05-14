import { spawn, type ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { logError, logInfo } from "@/lib/logger";

let comfyProcess: ChildProcess | null = null;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function comfyUrl() {
  const settings = await prisma.settings.findFirst();
  return (settings?.comfyServerUrl || "http://127.0.0.1:8188").replace(/\/$/, "");
}

export async function isComfyRunning() {
  const url = await comfyUrl();
  try {
    const response = await fetch(`${url}/system_stats`, { signal: AbortSignal.timeout(2500) });
    return { ok: response.ok, message: response.ok ? "ComfyUI is running." : `ComfyUI returned ${response.status}.`, url };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "ComfyUI is not running.", url };
  }
}

function commandParts(command: string, pythonPath?: string | null) {
  const trimmed = command.trim() || "python main.py --listen 127.0.0.1 --port 8188";
  const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, "")) || [];
  if (!parts.length) return { command: pythonPath || "python", args: ["main.py", "--listen", "127.0.0.1", "--port", "8188"] };
  if (pythonPath && ["python", "python3"].includes(parts[0])) return { command: pythonPath, args: parts.slice(1) };
  return { command: parts[0], args: parts.slice(1) };
}

export async function startComfyUI(waitForReady = true) {
  const settings = await prisma.settings.findFirst();
  const running = await isComfyRunning();
  if (running.ok) return running;
  const cwd = settings?.comfyInstallFolder || "";
  if (!cwd || !existsSync(cwd)) {
    return { ok: false, message: "ComfyUI could not be started. Please open it manually or check your configured path.", url: running.url };
  }

  const launch = commandParts(settings?.comfyLaunchCommand || "", settings?.comfyPythonPath);
  comfyProcess = spawn(launch.command, launch.args, {
    cwd,
    env: process.env,
    detached: process.platform !== "win32",
    stdio: "ignore"
  });
  comfyProcess.unref();
  await logInfo("Started ComfyUI from Settings", { cwd, command: launch.command, args: launch.args });

  if (!waitForReady) return { ok: true, message: "ComfyUI launch command started.", url: running.url };
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const status = await isComfyRunning();
    if (status.ok) return status;
    await wait(2500);
  }
  return { ok: false, message: "ComfyUI could not be started. Please open it manually or check your configured path.", url: running.url };
}

export async function stopComfyUI() {
  if (comfyProcess?.pid) {
    try {
      process.kill(-comfyProcess.pid);
    } catch {
      try {
        comfyProcess.kill();
      } catch {
        // Ignore stop failures and report status below.
      }
    }
    comfyProcess = null;
    await logInfo("Stopped ComfyUI child process from Settings");
    return { ok: true, message: "ComfyUI stop signal sent." };
  }
  return { ok: false, message: "No ReelPilot-started ComfyUI process is active. Stop it manually if you opened it outside ReelPilot." };
}

export async function restartComfyUI() {
  await stopComfyUI();
  await wait(1000);
  return startComfyUI(true);
}

export async function openComfyUI() {
  const url = await comfyUrl();
  try {
    execFile(process.platform === "win32" ? "cmd" : "open", process.platform === "win32" ? ["/c", "start", url] : [url]);
    return { ok: true, message: `Opened ComfyUI: ${url}`, url };
  } catch (error) {
    await logError("Opening ComfyUI failed", error);
    return { ok: false, message: error instanceof Error ? error.message : String(error), url };
  }
}

export async function autoStartComfyIfEnabled() {
  const settings = await prisma.settings.findFirst();
  if (!settings?.comfyAutoStart) return { ok: true, message: "ComfyUI auto-start is disabled." };
  const running = await isComfyRunning();
  if (running.ok) return running;
  return startComfyUI(true);
}
