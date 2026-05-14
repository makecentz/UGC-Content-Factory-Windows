import { execFile } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, statfsSync } from "node:fs";
import { rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { prisma } from "@/lib/prisma";
import { logError, logInfo } from "@/lib/logger";

type WanModelFile = {
  label: string;
  fileName: string;
  folder: "diffusion_models" | "text_encoders" | "vae";
  url: string;
};

const wan22FiveBFiles: WanModelFile[] = [
  {
    label: "Wan 2.2 TI2V 5B diffusion model",
    fileName: "wan2.2_ti2v_5B_fp16.safetensors",
    folder: "diffusion_models",
    url: "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors"
  },
  {
    label: "Wan 2.2 VAE",
    fileName: "wan2.2_vae.safetensors",
    folder: "vae",
    url: "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan2.2_vae.safetensors"
  },
  {
    label: "UMT5 text encoder",
    fileName: "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
    folder: "text_encoders",
    url: "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors"
  }
];

const officialWan22TemplateUrl =
  "https://raw.githubusercontent.com/Comfy-Org/workflow_templates/refs/heads/main/templates/video_wan2_2_5B_ti2v.json";

function defaultComfyFolder() {
  return path.join(os.homedir(), "ComfyUI");
}

async function configuredComfyFolder() {
  const settings = await prisma.settings.findFirst();
  return settings?.comfyInstallFolder || process.env.COMFYUI_PATH || defaultComfyFolder();
}

function modelsRoot(comfyFolder: string) {
  return path.join(comfyFolder, "models");
}

function modelTargetPath(comfyFolder: string, file: WanModelFile) {
  return path.join(modelsRoot(comfyFolder), file.folder, file.fileName);
}

function ensureModelFolders(comfyFolder: string) {
  for (const folder of ["diffusion_models", "text_encoders", "vae"]) {
    mkdirSync(path.join(modelsRoot(comfyFolder), folder), { recursive: true });
  }
}

function formatGb(bytes: number) {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function diskFreeGb(target: string) {
  const root = existsSync(target) ? target : path.dirname(target);
  const stats = statfsSync(root);
  return stats.bavail * stats.bsize;
}

function execPowerShell(command: string) {
  return new Promise<string>((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], (error, stdout) => {
      resolve(error ? "" : stdout.trim());
    });
  });
}

async function gpuSummary() {
  if (process.platform !== "win32") return "GPU detection is only automated on Windows.";
  const output = await execPowerShell(
    "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress"
  );
  if (!output) return "No GPU details detected.";
  try {
    const parsed = JSON.parse(output);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items
      .map((item) => {
        const ram = Number(item.AdapterRAM || 0);
        return `${item.Name || "Unknown GPU"}${ram > 0 ? ` (${formatGb(ram)} reported VRAM)` : ""}`;
      })
      .join("; ");
  } catch {
    return output;
  }
}

export async function checkWanSetup() {
  const comfyFolder = await configuredComfyFolder();
  const existingFiles = wan22FiveBFiles.map((file) => {
    const targetPath = modelTargetPath(comfyFolder, file);
    return {
      label: file.label,
      fileName: file.fileName,
      folder: file.folder,
      targetPath,
      installed: existsSync(targetPath)
    };
  });
  const workflowPath = path.join(comfyFolder, "workflows", "video_wan2_2_5B_ti2v.json");
  const freeBytes = diskFreeGb(comfyFolder);
  return {
    ok: existingFiles.every((file) => file.installed),
    message: existingFiles.every((file) => file.installed)
      ? "Wan 2.2 5B model files are installed."
      : "Wan 2.2 5B model files are not fully installed yet.",
    comfyFolder,
    workflowPath,
    workflowInstalled: existsSync(workflowPath),
    freeDisk: formatGb(freeBytes),
    gpu: await gpuSummary(),
    files: existingFiles
  };
}

export async function prepareWanFolders() {
  const comfyFolder = await configuredComfyFolder();
  ensureModelFolders(comfyFolder);
  mkdirSync(path.join(comfyFolder, "workflows"), { recursive: true });
  const current = await prisma.settings.findFirst();
  const data = {
    comfyEnabled: true,
    comfyInstallFolder: comfyFolder,
    comfyWanVersion: "wan22",
    comfyWorkflowType: "text-to-video",
    comfyServerUrl: current?.comfyServerUrl || "http://127.0.0.1:8188"
  };
  if (current) await prisma.settings.update({ where: { id: current.id }, data });
  else {
    await prisma.settings.create({
      data: {
        ...data,
        openaiApiKeySaved: false,
        comfyCloudApiKeySaved: false,
        exportsFolder: "./storage/exports"
      }
    });
  }
  await logInfo("Prepared Wan model folders", { comfyFolder });
  return { ok: true, message: `Prepared ComfyUI folders at ${comfyFolder}`, comfyFolder };
}

async function downloadFile(file: WanModelFile, comfyFolder: string, token?: string) {
  const targetPath = modelTargetPath(comfyFolder, file);
  if (existsSync(targetPath)) return { ...file, targetPath, installed: true, skipped: true };

  mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.download`;
  await rm(tempPath, { force: true });

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(file.url, { headers });
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(`Could not download ${file.fileName}. ${response.status} ${text || response.statusText}`);
  }

  await pipeline(response.body as any, createWriteStream(tempPath));
  await rename(tempPath, targetPath);
  return { ...file, targetPath, installed: true, skipped: false };
}

async function downloadOfficialWorkflow(comfyFolder: string) {
  const targetPath = path.join(comfyFolder, "workflows", "video_wan2_2_5B_ti2v.json");
  mkdirSync(path.dirname(targetPath), { recursive: true });
  const response = await fetch(officialWan22TemplateUrl);
  if (!response.ok) throw new Error(`Could not download the official Wan workflow template. ${response.status}`);
  await writeFile(targetPath, await response.text());
  return targetPath;
}

export async function installWan22FiveB(token?: string) {
  const comfyFolder = await configuredComfyFolder();
  ensureModelFolders(comfyFolder);
  mkdirSync(path.join(comfyFolder, "workflows"), { recursive: true });
  await logInfo("Wan 2.2 5B install started", { comfyFolder });

  const downloaded = [];
  try {
    for (const file of wan22FiveBFiles) {
      downloaded.push(await downloadFile(file, comfyFolder, token));
    }
    const workflowPath = await downloadOfficialWorkflow(comfyFolder);
    const current = await prisma.settings.findFirst();
    const data = {
      comfyEnabled: true,
      comfyInstallFolder: comfyFolder,
      comfyWanVersion: "wan22",
      comfyWorkflowType: "text-to-video",
      comfyDefaultWidth: 576,
      comfyDefaultHeight: 1024,
      comfyDefaultFrames: 81,
      comfyDefaultFps: 16,
      comfyDefaultSteps: 20,
      comfyDefaultGuidance: 5
    };
    if (current) await prisma.settings.update({ where: { id: current.id }, data });
    else {
      await prisma.settings.create({
        data: {
          ...data,
          openaiApiKeySaved: false,
          comfyCloudApiKeySaved: false,
          exportsFolder: "./storage/exports"
        }
      });
    }
    await logInfo("Wan 2.2 5B install completed", { comfyFolder, workflowPath });
    return {
      ok: true,
      message: "Wan 2.2 5B model pack is installed. Open ComfyUI, load the downloaded workflow template once, then export API JSON for full Wan motion automation.",
      comfyFolder,
      workflowPath,
      files: downloaded
    };
  } catch (error) {
    await logError("Wan 2.2 5B install failed", error, { comfyFolder });
    throw error;
  }
}
