import { createWriteStream, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { prisma } from "@/lib/prisma";
import { localConfigValue } from "@/lib/local-config";
import { normalizeVideoClip } from "@/lib/ffmpeg";
import { storagePath } from "@/lib/storage";
import type { GenerateSceneClipInput, SceneClipJob, SceneClipStatus, VideoProvider } from "./video-provider";
import {
  downloadOutputFile,
  findOutputFilesFromHistory,
  getExecutionErrorFromHistory,
  getObjectInfo,
  submitPrompt,
  waitForPromptCompletion
} from "./comfyui/comfyui-client";
import {
  getWorkflowNodeMap,
  injectDurationIntoWorkflow,
  injectNegativePromptIntoWorkflow,
  injectPromptIntoWorkflow,
  injectSeedIntoWorkflow,
  injectVideoSettingsIntoWorkflow,
  loadWorkflowTemplate,
  randomSeed
} from "./comfyui/workflow-loader";

type CloudOutputFile = {
  filename: string;
  subfolder?: string;
  type?: string;
};

type CloudJob = {
  status: SceneClipStatus;
  mode?: "cloud-rest" | "account-api-node";
  outputs?: Record<string, any>;
  rawOutputPath?: string;
  outputPath?: string;
  logId?: string;
  aspectRatio?: "9:16" | "16:9";
  waitPromise?: Promise<Record<string, any>>;
};

const jobs = new Map<string, CloudJob>();
const baseUrl = "https://cloud.comfy.org";
const negativePrompt = "text, subtitles, captions, watermark, logo, blurry, distorted hands, deformed face, extra fingers, low quality, bad anatomy, unreadable text";

function apiKey() {
  return localConfigValue("COMFY_CLOUD_API_KEY");
}

function requireApiKey() {
  const key = apiKey();
  if (!key) throw new Error("COMFY_CLOUD_API_KEY is missing. Add your Comfy Cloud API key in Settings, then try again.");
  return key;
}

function isAccountApiNodeKey(key: string) {
  return /^comfy/i.test(key);
}

async function cloudFetch(pathname: string, init?: RequestInit) {
  const key = requireApiKey();
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      "X-API-Key": key,
      ...(init?.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status === 401) {
      throw new Error(
        "Comfy Cloud rejected the saved API key. Create or copy a key from https://platform.comfy.org/profile/api-keys, make sure the account has an active Comfy Cloud subscription, then save the key again in Settings."
      );
    }
    if (response.status === 402) throw new Error("Comfy Cloud reported insufficient credits for this render.");
    if (response.status === 429) throw new Error("Comfy Cloud subscription is inactive or currently rate limited.");
    throw new Error(`Comfy Cloud request failed (${response.status}). ${text || "Try again later."}`);
  }
  return response;
}

export async function testComfyCloudConnection() {
  try {
    const key = requireApiKey();
    if (isAccountApiNodeKey(key)) {
      await getObjectInfo();
      return {
        ok: true,
        message: "Comfy Account API key is saved. Local ComfyUI API-node mode is ready for Wan API workflows."
      };
    }
    await cloudFetch("/api/user");
    return { ok: true, message: "Comfy Cloud REST API connection works." };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Payment Required/i.test(message)) {
      return {
        ok: false,
        message: "Comfy API key is accepted, but Comfy reports Payment Required. Add credits or confirm billing/credits are active on the Comfy account, then try again."
      };
    }
    return { ok: false, message };
  }
}

async function settingsForCloud() {
  const settings = await prisma.settings.findFirst();
  return {
    workflowPath: settings?.comfyCloudWorkflowPath || null,
    wanVersion: (settings?.comfyWanVersion || "wan22") as "wan21" | "wan22",
    workflowType: (settings?.comfyWorkflowType || "text-to-video") as "text-to-video" | "image-to-video" | "custom-workflow",
    width: settings?.comfyDefaultWidth ?? 576,
    height: settings?.comfyDefaultHeight ?? 1024,
    frames: settings?.comfyDefaultFrames ?? 81,
    fps: settings?.comfyDefaultFps ?? 16,
    steps: settings?.comfyDefaultSteps ?? 20,
    guidance: settings?.comfyDefaultGuidance ?? 5,
    timeoutMinutes: settings?.comfyTimeoutMinutes ?? 45,
    seedMode: settings?.comfySeedMode || "random"
  };
}

function extractOutputFiles(outputs: Record<string, any> | undefined): CloudOutputFile[] {
  const files: CloudOutputFile[] = [];
  if (!outputs) return files;
  for (const output of Object.values(outputs) as any[]) {
    for (const key of ["video", "videos", "gifs", "images", "audio"]) {
      const value = output?.[key];
      const items = Array.isArray(value) ? value : value ? [value] : [];
      for (const item of items) {
        if (item?.filename) files.push({ filename: item.filename, subfolder: item.subfolder || "", type: item.type || "output" });
      }
    }
  }
  return files;
}

function isVideoFile(fileName: string) {
  return /\.(mp4|mov|webm|mkv|avi)$/i.test(fileName);
}

async function waitForCloudCompletion(promptId: string, timeoutMinutes: number) {
  const key = requireApiKey();
  const WebSocketCtor = globalThis.WebSocket;
  if (!WebSocketCtor) throw new Error("This Node runtime does not support WebSocket for Comfy Cloud progress.");

  return new Promise<Record<string, any>>((resolve, reject) => {
    const outputs: Record<string, any> = {};
    const ws = new WebSocketCtor(`wss://cloud.comfy.org/ws?clientId=${crypto.randomUUID()}&token=${encodeURIComponent(key)}`);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("Comfy Cloud generation exceeded the configured timeout."));
    }, Math.max(1, timeoutMinutes) * 60_000);

    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      const data = JSON.parse(event.data);
      const msgData = data.data ?? {};
      if (msgData.prompt_id && msgData.prompt_id !== promptId) return;
      if (data.type === "executed" && msgData.output) outputs[msgData.node] = msgData.output;
      if (data.type === "execution_success") {
        clearTimeout(timer);
        ws.close();
        resolve(outputs);
      }
      if (data.type === "execution_error") {
        clearTimeout(timer);
        ws.close();
        reject(new Error(msgData.exception_message || "Comfy Cloud execution failed."));
      }
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Comfy Cloud WebSocket connection failed."));
    };
  });
}

async function downloadCloudOutput(fileInfo: CloudOutputFile, outputPath: string) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const params = new URLSearchParams({
    filename: fileInfo.filename,
    subfolder: fileInfo.subfolder || "",
    type: fileInfo.type || "output"
  });
  const response = await cloudFetch(`/api/view?${params.toString()}`, { redirect: "manual" });
  const signedUrl = response.headers.get("location");
  const fileResponse = signedUrl ? await fetch(signedUrl) : response;
  if (!fileResponse.ok || !fileResponse.body) throw new Error(`Comfy Cloud output download failed: ${fileResponse.status}`);
  await pipeline(fileResponse.body as any, createWriteStream(outputPath));
  return outputPath;
}

export const comfyCloudProvider: VideoProvider = {
  name: "comfy-cloud",
  async generateSceneClip(input: GenerateSceneClipInput): Promise<SceneClipJob> {
    const config = await settingsForCloud();
    const map = await getWorkflowNodeMap();
    const workflowType = input.mode || config.workflowType;
    const { workflow, filePath } = await loadWorkflowTemplate({
      wanVersion: config.wanVersion,
      workflowType,
      customPath: config.workflowPath,
      skipLocalValidation: true
    });
    const seed = input.seed ? Number(input.seed) : config.seedMode === "fixed" ? 1 : randomSeed();

    injectPromptIntoWorkflow(workflow, input.prompt, map);
    injectNegativePromptIntoWorkflow(workflow, negativePrompt, map);
    injectVideoSettingsIntoWorkflow(
      workflow,
      {
        width: input.localVideoSettings?.width ?? config.width,
        height: input.localVideoSettings?.height ?? config.height,
        frames: input.localVideoSettings?.frames ?? config.frames,
        fps: input.localVideoSettings?.fps ?? config.fps,
        steps: input.localVideoSettings?.steps ?? config.steps,
        guidance: input.localVideoSettings?.guidance ?? config.guidance
      },
      map
    );
    injectDurationIntoWorkflow(workflow, input.duration, map);
    injectSeedIntoWorkflow(workflow, seed, map);

    const log = await prisma.providerJobLog.create({
      data: {
        provider: "comfy-cloud",
        projectType: input.projectType,
        ownerId: input.sceneId,
        prompt: input.prompt,
        negativePrompt,
        workflowPath: filePath,
        status: "submitted"
      }
    });
    const submittedWorkflowPath = storagePath("comfyui/workflows", `submitted-comfy-cloud-${log.id}.json`);
    await writeFile(submittedWorkflowPath, JSON.stringify(workflow, null, 2));
    await prisma.providerJobLog.update({ where: { id: log.id }, data: { workflowPath: submittedWorkflowPath } });

    try {
      if (isAccountApiNodeKey(requireApiKey())) {
        const result = await submitPrompt(workflow, { api_key_comfy_org: requireApiKey() });
        jobs.set(result.promptId, {
          mode: "account-api-node",
          status: { status: "generating", progress: 10 },
          logId: log.id,
          aspectRatio: input.aspectRatio
        });
        await prisma.providerJobLog.update({ where: { id: log.id }, data: { promptId: result.promptId, status: "generating" } });
        return { jobId: result.promptId };
      }

      const response = await cloudFetch("/api/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: workflow,
          extra_data: { api_key_comfy_org: requireApiKey() }
        })
      }).then((item) => item.json());
      const promptId = response.prompt_id || response.promptId;
      if (!promptId) throw new Error("Comfy Cloud did not return a prompt_id.");
      const waitPromise = waitForCloudCompletion(promptId, config.timeoutMinutes);
      waitPromise.catch(() => undefined);
      jobs.set(promptId, { mode: "cloud-rest", status: { status: "generating", progress: 10 }, logId: log.id, aspectRatio: input.aspectRatio, waitPromise });
      await prisma.providerJobLog.update({ where: { id: log.id }, data: { promptId, status: "generating" } });
      return { jobId: promptId };
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      const message = /Payment Required/i.test(rawMessage)
        ? "Comfy API key is accepted, but Comfy reports Payment Required. Add credits or confirm billing/credits are active on the Comfy account, then try again."
        : rawMessage;
      await prisma.providerJobLog.update({ where: { id: log.id }, data: { status: "failed", completedAt: new Date(), error: message } });
      throw new Error(message);
    }
  },
  async getSceneClipStatus(jobId: string): Promise<SceneClipStatus> {
    const job = jobs.get(jobId);
    if (job?.status.status === "ready" || job?.status.status === "failed") return job.status;
    try {
      if (job?.mode === "account-api-node") {
        const config = await settingsForCloud();
        const history = await waitForPromptCompletion(jobId, config.timeoutMinutes);
        const executionError = getExecutionErrorFromHistory(history);
        if (executionError) throw new Error(executionError);
        const files = findOutputFilesFromHistory(history);
        const selected = files.find((file) => isVideoFile(file.filename)) || files[0];
        if (!selected) throw new Error("ComfyUI finished but did not return a downloadable video output.");
        const rawOutputPath = storagePath("comfyui/outputs", `${jobId}${path.extname(selected.filename) || ".mp4"}`);
        await downloadOutputFile(selected, rawOutputPath);
        jobs.set(jobId, { ...job, rawOutputPath, status: { status: "ready", progress: 100, downloadUrl: rawOutputPath } });
        if (job?.logId) await prisma.providerJobLog.update({ where: { id: job.logId }, data: { status: "ready", completedAt: new Date(), outputPath: rawOutputPath } });
        return { status: "ready", progress: 100, downloadUrl: rawOutputPath };
      }

      const statusResponse = await cloudFetch(`/api/job/${encodeURIComponent(jobId)}/status`).then((item) => item.json()).catch(() => null);
      const status = String(statusResponse?.status || "");
      if (status === "pending") return { status: "pending", progress: 5 };
      if (status === "failed" || status === "cancelled") throw new Error(`Comfy Cloud job ${status}.`);

      const outputs = statusResponse?.outputs || statusResponse?.output || statusResponse?.history?.outputs || (await job?.waitPromise);
      const files = extractOutputFiles(outputs);
      const selected = files.find((file) => isVideoFile(file.filename)) || files[0];
      if (!selected) throw new Error("Comfy Cloud finished but did not return a downloadable video output.");
      const rawOutputPath = storagePath("comfyui/outputs", `${jobId}${path.extname(selected.filename) || ".mp4"}`);
      await downloadCloudOutput(selected, rawOutputPath);
      jobs.set(jobId, { ...job, outputs, rawOutputPath, status: { status: "ready", progress: 100, downloadUrl: rawOutputPath } });
      if (job?.logId) await prisma.providerJobLog.update({ where: { id: job.logId }, data: { status: "ready", completedAt: new Date(), outputPath: rawOutputPath } });
      return { status: "ready", progress: 100, downloadUrl: rawOutputPath };
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      const message = /Payment Required/i.test(rawMessage)
        ? "Comfy API key is accepted, but Comfy reports Payment Required. Add credits or confirm billing/credits are active on the Comfy account, then try again."
        : rawMessage;
      jobs.set(jobId, { ...job, status: { status: "failed", errorMessage: message } });
      if (job?.logId) await prisma.providerJobLog.update({ where: { id: job.logId }, data: { status: "failed", completedAt: new Date(), error: message } });
      return { status: "failed", errorMessage: message };
    }
  },
  async downloadSceneClip(jobId: string, outputPath: string) {
    const job = jobs.get(jobId);
    if (!job?.rawOutputPath || !existsSync(job.rawOutputPath)) throw new Error("Comfy Cloud clip is not ready to download yet.");
    const normalizedPath = outputPath || storagePath("scenes/comfy-cloud", `${jobId}.mp4`);
    await normalizeVideoClip(job.rawOutputPath, normalizedPath, job.aspectRatio || "9:16");
    jobs.set(jobId, { ...job, outputPath: normalizedPath, status: { status: "ready", progress: 100, downloadUrl: normalizedPath } });
    if (job.logId) await prisma.providerJobLog.update({ where: { id: job.logId }, data: { outputPath: normalizedPath } });
    return normalizedPath;
  }
};
