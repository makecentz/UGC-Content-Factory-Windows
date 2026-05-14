import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { normalizeVideoClip, renderVerticalVideo } from "@/lib/ffmpeg";
import { storagePath } from "@/lib/storage";
import type { GenerateSceneClipInput, SceneClipJob, SceneClipStatus, VideoProvider } from "./video-provider";
import { downloadOutputFile, findOutputFilesFromHistory, getExecutionErrorFromHistory, getObjectInfo, submitPrompt, waitForPromptCompletion } from "./comfyui/comfyui-client";
import {
  getWorkflowNodeMap,
  injectDurationIntoWorkflow,
  injectNegativePromptIntoWorkflow,
  injectPromptIntoWorkflow,
  injectReferenceImageIntoWorkflow,
  injectSeedIntoWorkflow,
  injectVideoSettingsIntoWorkflow,
  loadWorkflowTemplate,
  randomSeed,
  type WanVersion,
  type WorkflowType
} from "./comfyui/workflow-loader";
import { friendlyLocalWanError } from "./comfyui/workflow-validator";

type WanJob = {
  status: SceneClipStatus;
  rawOutputPath?: string;
  outputPath?: string;
  logId?: string;
  aspectRatio?: "9:16" | "16:9";
  duration?: number;
};

const jobs = new Map<string, WanJob>();

const negativePrompt = "text, subtitles, captions, watermark, logo, blurry, distorted hands, deformed face, extra fingers, low quality, bad anatomy, unreadable text, cropped face";

function outputExtension(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return extension || ".mp4";
}

function isVideoFile(fileName: string) {
  return /\.(mp4|mov|webm|mkv|avi)$/i.test(fileName);
}

function isImageFile(fileName: string) {
  return /\.(png|jpg|jpeg|webp)$/i.test(fileName);
}

function fileExtension(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return extension || ".bin";
}

function firstChoice(objectInfo: any, classType: string, inputName: string) {
  const choices = objectInfo?.[classType]?.input?.required?.[inputName]?.[0];
  return Array.isArray(choices) && choices.length ? choices[0] : "";
}

async function hydrateBundledComfyWorkflow(workflow: any) {
  const objectInfo = await getObjectInfo();
  const checkpoint = firstChoice(objectInfo, "CheckpointLoaderSimple", "ckpt_name");
  for (const node of Object.values(workflow) as any[]) {
    if (!node?.inputs) continue;
    if (node.class_type === "CheckpointLoaderSimple" && (!node.inputs.ckpt_name || String(node.inputs.ckpt_name).includes("REELPILOT_CHECKPOINT"))) {
      if (!checkpoint) {
        throw new Error("ComfyUI is running, but no checkpoint is installed. Add a model checkpoint in ComfyUI/models/checkpoints or select your local Wan workflow in Settings.");
      }
      node.inputs.ckpt_name = checkpoint;
    }
  }
  return workflow;
}

async function settingsForProvider(version: WanVersion) {
  const settings = await prisma.settings.findFirst();
  return {
    workflowType: (settings?.comfyWorkflowType || "text-to-video") as WorkflowType,
    customPath: settings?.comfyWorkflowPath,
    width: settings?.comfyDefaultWidth ?? 576,
    height: settings?.comfyDefaultHeight ?? 1024,
    frames: settings?.comfyDefaultFrames ?? 81,
    fps: settings?.comfyDefaultFps ?? 16,
    steps: settings?.comfyDefaultSteps ?? 20,
    guidance: settings?.comfyDefaultGuidance ?? 5,
    timeoutMinutes: settings?.comfyTimeoutMinutes ?? 45,
    seedMode: settings?.comfySeedMode || "random",
    wanVersion: (settings?.comfyWanVersion || version) as WanVersion,
    localDraftMode: settings?.comfyLocalDraftMode ?? false
  };
}

export function createLocalComfyWanProvider(version: WanVersion): VideoProvider {
  return {
    name: `local-comfyui-${version}`,
    async generateSceneClip(input: GenerateSceneClipInput): Promise<SceneClipJob> {
      const config = await settingsForProvider(version);
      const requestedWorkflowType = input.mode || config.workflowType;
      const workflowType = requestedWorkflowType === "custom-workflow" ? "custom-workflow" : requestedWorkflowType;
      const referenceImage = workflowType === "image-to-video" ? input.referenceImages?.find((item) => item && existsSync(item)) : null;
      const map = await getWorkflowNodeMap();
      let workflow: any;
      let filePath = "";
      try {
        const loaded = await loadWorkflowTemplate({
          wanVersion: version,
          workflowType,
          customPath: config.customPath,
          requireLocalWorkflow: true
        });
        workflow = loaded.workflow;
        filePath = loaded.filePath;
      } catch (error) {
        const message = friendlyLocalWanError(error instanceof Error ? error.message : String(error));
        await prisma.providerJobLog.create({
          data: {
            provider: `local-comfyui-${version}`,
            projectType: input.projectType,
            ownerId: input.sceneId,
            prompt: input.prompt,
            negativePrompt,
            workflowPath: config.customPath || `${config.wanVersion}-${workflowType}.json`,
            status: "failed",
            completedAt: new Date(),
            error: message
          }
        });
        throw new Error(message);
      }
      const seed = input.seed ? Number(input.seed) : config.seedMode === "fixed" ? 1 : randomSeed();

      injectPromptIntoWorkflow(workflow, input.prompt, map);
      injectNegativePromptIntoWorkflow(workflow, negativePrompt, map);
      injectVideoSettingsIntoWorkflow(
        workflow,
        {
          width: input.localVideoSettings?.width ?? (config.localDraftMode ? 384 : config.width),
          height: input.localVideoSettings?.height ?? (config.localDraftMode ? 672 : config.height),
          frames: input.localVideoSettings?.frames ?? (config.localDraftMode ? Math.min(config.frames, 49) : config.frames),
          fps: input.localVideoSettings?.fps ?? config.fps,
          steps: input.localVideoSettings?.steps ?? (config.localDraftMode ? Math.min(config.steps, 12) : config.steps),
          guidance: input.localVideoSettings?.guidance ?? config.guidance
        },
        map
      );
      injectDurationIntoWorkflow(workflow, input.duration, map);
      injectSeedIntoWorkflow(workflow, seed, map);
      injectReferenceImageIntoWorkflow(workflow, referenceImage, map);
      workflow = await hydrateBundledComfyWorkflow(workflow);

      const log = await prisma.providerJobLog.create({
        data: {
          provider: `local-comfyui-${version}`,
          projectType: input.projectType,
          ownerId: input.sceneId,
          prompt: input.prompt,
          negativePrompt,
          workflowPath: filePath,
          status: "submitted"
        }
      });
      const submittedWorkflowPath = storagePath("comfyui/workflows", `submitted-${log.id}.json`);
      await writeFile(submittedWorkflowPath, JSON.stringify(workflow, null, 2));
      await prisma.providerJobLog.update({ where: { id: log.id }, data: { workflowPath: submittedWorkflowPath } });

      try {
        const result = await submitPrompt(workflow);
        jobs.set(result.promptId, { status: { status: "generating", progress: 10 }, logId: log.id, aspectRatio: input.aspectRatio, duration: input.duration });
        await prisma.providerJobLog.update({ where: { id: log.id }, data: { promptId: result.promptId, status: "generating" } });
        return { jobId: result.promptId };
      } catch (error) {
        const message = friendlyLocalWanError(error instanceof Error ? error.message : String(error));
        await prisma.providerJobLog.update({
          where: { id: log.id },
          data: { status: "failed", completedAt: new Date(), error: message }
        });
        throw new Error(message);
      }
    },
    async getSceneClipStatus(jobId: string): Promise<SceneClipStatus> {
      const job = jobs.get(jobId);
      if (job?.status.status === "ready" || job?.status.status === "failed") return job.status;

      try {
        const config = await settingsForProvider(version);
        const history = await waitForPromptCompletion(jobId, config.timeoutMinutes);
        const executionError = getExecutionErrorFromHistory(history);
        if (executionError) throw new Error(executionError);
        const files = findOutputFilesFromHistory(history);
        const selected = files.find((file) => isVideoFile(file.filename)) || files.find((file) => isImageFile(file.filename));
        if (!selected) throw new Error("No generated video or image found. Check your ComfyUI output folder and workflow save node.");
        const rawOutputPath = storagePath("comfyui/outputs", `${jobId}${fileExtension(selected.filename)}`);
        await downloadOutputFile(selected, rawOutputPath);
        jobs.set(jobId, { ...job, rawOutputPath, status: { status: "ready", progress: 100, downloadUrl: rawOutputPath } });
        if (job?.logId) {
          await prisma.providerJobLog.update({ where: { id: job.logId }, data: { status: "ready", completedAt: new Date(), outputPath: rawOutputPath } });
        }
        return { status: "ready", progress: 100, downloadUrl: rawOutputPath };
      } catch (error) {
        const message = friendlyLocalWanError(error instanceof Error ? error.message : String(error));
        jobs.set(jobId, { ...job, status: { status: "failed", errorMessage: message } });
        if (job?.logId) {
          await prisma.providerJobLog.update({ where: { id: job.logId }, data: { status: "failed", completedAt: new Date(), error: message } });
        }
        return { status: "failed", errorMessage: message };
      }
    },
    async downloadSceneClip(jobId: string, outputPath: string) {
      const job = jobs.get(jobId);
      if (!job?.rawOutputPath || !existsSync(job.rawOutputPath)) {
        throw new Error("Local Wan clip is not ready to download yet.");
      }
      const normalizedPath = outputPath || storagePath("scenes/local-wan", `${jobId}.mp4`);
      if (isImageFile(job.rawOutputPath)) {
        await renderVerticalVideo({
          backgroundPath: job.rawOutputPath,
          outputPath: normalizedPath,
          durationSeconds: job.duration || 5,
          effects: ["Zoom motion"],
          aspectRatio: job.aspectRatio || "9:16"
        });
      } else {
        await normalizeVideoClip(job.rawOutputPath, normalizedPath, job.aspectRatio || "9:16");
      }
      jobs.set(jobId, { ...job, outputPath: normalizedPath, status: { status: "ready", progress: 100, downloadUrl: normalizedPath } });
      if (job.logId) {
        await prisma.providerJobLog.update({ where: { id: job.logId }, data: { outputPath: normalizedPath } });
      }
      return normalizedPath;
    }
  };
}
