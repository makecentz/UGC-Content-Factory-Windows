import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { validateComfyWorkflowForLocalRender } from "./workflow-validator";

export type WorkflowType = "text-to-video" | "image-to-video" | "custom-workflow";
export type WanVersion = "wan21" | "wan22";

export type WorkflowNodeMap = {
  positivePromptNodeId?: string;
  positivePromptInputName?: string;
  negativePromptNodeId?: string;
  negativePromptInputName?: string;
  widthNodeId?: string;
  widthInputName?: string;
  heightNodeId?: string;
  heightInputName?: string;
  framesNodeId?: string;
  framesInputName?: string;
  fpsNodeId?: string;
  fpsInputName?: string;
  stepsNodeId?: string;
  stepsInputName?: string;
  guidanceNodeId?: string;
  guidanceInputName?: string;
  durationNodeId?: string;
  durationInputName?: string;
  seedNodeId?: string;
  seedInputName?: string;
  referenceImageNodeId?: string;
  referenceImageInputName?: string;
};

export type VideoSettings = {
  width: number;
  height: number;
  frames: number;
  fps: number;
  steps?: number;
  guidance?: number;
};

const defaultMap: WorkflowNodeMap = {
  positivePromptNodeId: "1",
  positivePromptInputName: "prompt",
  negativePromptNodeId: "1",
  negativePromptInputName: "negative_prompt",
  durationNodeId: "1",
  durationInputName: "duration",
  seedNodeId: "1",
  seedInputName: "seed",
  referenceImageNodeId: "10",
  referenceImageInputName: "image"
};

function workflowRoot() {
  return workflowRootCandidates()[0];
}

function workflowRootCandidates() {
  const candidates = [
    process.env.REELPILOT_WORKFLOWS_PATH,
    process.env.REELPILOT_APP_ROOT ? path.join(process.env.REELPILOT_APP_ROOT, "workflows") : "",
    process.env.REELPILOT_RESOURCES_PATH ? path.join(process.env.REELPILOT_RESOURCES_PATH, "app", "workflows") : "",
    process.env.REELPILOT_RESOURCES_PATH ? path.join(process.env.REELPILOT_RESOURCES_PATH, "workflows") : "",
    path.join(process.cwd(), "workflows")
  ].filter(Boolean) as string[];
  return [...new Set(candidates)];
}

function findWorkflowFile(wanVersion: WanVersion, workflowType: WorkflowType, preferLocal = false) {
  const fileNames = preferLocal
    ? [
        `${wanVersion}-${workflowType}.local.json`,
        `${wanVersion}-local-${workflowType}.json`,
        `local-${wanVersion}-${workflowType}.json`,
        `${wanVersion}-${workflowType}.json`
      ]
    : [`${wanVersion}-${workflowType}.json`];
  for (const root of workflowRootCandidates()) {
    for (const fileName of fileNames) {
      const candidate = path.join(root, fileName);
      if (existsSync(candidate)) return candidate;
    }
  }
  return path.join(workflowRoot(), fileNames[0]);
}

function isExplicitLocalWorkflowFile(filePath: string) {
  const fileName = path.basename(filePath).toLowerCase();
  return fileName.startsWith("local-") || fileName.includes("-local-") || fileName.includes(".local.");
}

export async function getWorkflowNodeMap(): Promise<WorkflowNodeMap> {
  const settings = await prisma.settings.findFirst();
  if (!settings?.comfyNodeMapJson) return defaultMap;
  try {
    return { ...defaultMap, ...(JSON.parse(settings.comfyNodeMapJson) as WorkflowNodeMap) };
  } catch {
    throw new Error("Node mapping JSON is invalid. Open workflow-node-map.example.json and match the node IDs from your ComfyUI workflow.");
  }
}

export async function loadWorkflowTemplate({
  wanVersion,
  workflowType,
  customPath,
  skipLocalValidation = false,
  requireLocalWorkflow = false
}: {
  wanVersion: WanVersion;
  workflowType: WorkflowType;
  customPath?: string | null;
  skipLocalValidation?: boolean;
  requireLocalWorkflow?: boolean;
}) {
  const customWorkflowPath = customPath?.trim();
  const hasCustomPath = Boolean(customWorkflowPath) && (workflowType === "custom-workflow" || requireLocalWorkflow);
  const filePath =
    hasCustomPath
      ? path.resolve(customWorkflowPath as string)
      : findWorkflowFile(wanVersion, workflowType, requireLocalWorkflow);
  if (!existsSync(filePath)) {
    const localHint = requireLocalWorkflow
      ? " Export a true local Wan API workflow from ComfyUI, then select it in Settings > Local workflow JSON path."
      : "";
    throw new Error(`Workflow JSON missing. ReelPilot checked: ${workflowRootCandidates().join(", ")}.${localHint}`);
  }
  if (requireLocalWorkflow && !hasCustomPath && !isExplicitLocalWorkflowFile(filePath)) {
    throw new Error(
      "Comfy Local needs a true local Wan workflow JSON. ReelPilot will not default to the bundled Wan API examples. Export a local Wan 2.1 or Wan 2.2 API workflow from ComfyUI, then select that file in Settings > Local workflow JSON path."
    );
  }
  const workflow = JSON.parse(readFileSync(filePath, "utf8"));
  stripWorkflowMetadata(workflow);
  validateWorkflow(workflow);
  if (!skipLocalValidation) {
    const localValidation = validateComfyWorkflowForLocalRender(workflow);
    if (!localValidation.ok) {
      if (requireLocalWorkflow && !hasCustomPath) {
        throw new Error(
          "Comfy Local needs a true local Wan workflow JSON. The bundled Wan API example is for cloud/API rendering and was not used. Open ComfyUI, load a local Wan 2.1 or Wan 2.2 workflow that uses local model files, export it in API format, then select that file in Settings > Local workflow JSON path."
        );
      }
      const details = localValidation.forbiddenNodes.map((node) => `Node ${node.nodeId}: ${node.classType}. ${node.reason}`).join(" ");
      throw new Error(`${localValidation.message}${details ? ` ${details}` : ""}`);
    }
  }
  return { workflow, filePath };
}

function stripWorkflowMetadata(workflow: unknown) {
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) return;
  for (const key of Object.keys(workflow as Record<string, unknown>)) {
    const value = (workflow as Record<string, unknown>)[key];
    if (key.startsWith("_") || !value || typeof value !== "object" || Array.isArray(value)) {
      delete (workflow as Record<string, unknown>)[key];
    }
  }
}

function setMappedInput(workflow: any, nodeId?: string, inputName?: string, value?: unknown) {
  if (!nodeId || !inputName || value === undefined || value === null) return;
  const node = workflow[nodeId];
  if (!node?.inputs) {
    throw new Error(`Node mapping failed for node ${nodeId}.${inputName}. Match the node IDs from your ComfyUI workflow.`);
  }
  node.inputs[inputName] = value;
}

function replacePlaceholderInputs(workflow: any, placeholders: string[], value: string) {
  let replacements = 0;
  for (const node of Object.values(workflow) as any[]) {
    if (!node?.inputs) continue;
    for (const [key, inputValue] of Object.entries(node.inputs)) {
      if (typeof inputValue === "string" && placeholders.some((placeholder) => inputValue.includes(placeholder))) {
        node.inputs[key] = value;
        replacements += 1;
      }
    }
  }
  return replacements;
}

export function injectPromptIntoWorkflow(workflow: any, prompt: string, map: WorkflowNodeMap) {
  setMappedInput(workflow, map.positivePromptNodeId, map.positivePromptInputName, prompt);
  replacePlaceholderInputs(workflow, ["REELPILOT_PROMPT", "__PROMPT__", "PROMPT"], prompt);
  return workflow;
}

export function injectNegativePromptIntoWorkflow(workflow: any, negativePrompt: string, map: WorkflowNodeMap) {
  setMappedInput(workflow, map.negativePromptNodeId, map.negativePromptInputName, negativePrompt);
  replacePlaceholderInputs(workflow, ["REELPILOT_NEGATIVE_PROMPT", "__NEGATIVE_PROMPT__", "NEGATIVE_PROMPT"], negativePrompt);
  return workflow;
}

export function injectSeedIntoWorkflow(workflow: any, seed: number, map: WorkflowNodeMap) {
  setMappedInput(workflow, map.seedNodeId, map.seedInputName, seed);
  return workflow;
}

export function injectVideoSettingsIntoWorkflow(workflow: any, settings: VideoSettings, map: WorkflowNodeMap) {
  setMappedInput(workflow, map.widthNodeId, map.widthInputName, settings.width);
  setMappedInput(workflow, map.heightNodeId, map.heightInputName, settings.height);
  setMappedInput(workflow, map.framesNodeId, map.framesInputName, settings.frames);
  setMappedInput(workflow, map.fpsNodeId, map.fpsInputName, settings.fps);
  setMappedInput(workflow, map.stepsNodeId, map.stepsInputName, settings.steps);
  setMappedInput(workflow, map.guidanceNodeId, map.guidanceInputName, settings.guidance);
  return workflow;
}

export function injectDurationIntoWorkflow(workflow: any, durationSeconds: number, map: WorkflowNodeMap) {
  const duration = Math.max(2, Math.min(15, Math.round(durationSeconds)));
  setMappedInput(workflow, map.durationNodeId, map.durationInputName, duration);
  return workflow;
}

export function injectReferenceImageIntoWorkflow(workflow: any, imagePath: string | null | undefined, map: WorkflowNodeMap) {
  if (!imagePath) return workflow;
  setMappedInput(workflow, map.referenceImageNodeId, map.referenceImageInputName, imagePath);
  return workflow;
}

export function validateWorkflow(workflow: unknown) {
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    throw new Error("Workflow JSON must be a ComfyUI API prompt object keyed by node id.");
  }
  return true;
}

export function randomSeed() {
  return Math.floor(Math.random() * 2_147_483_647);
}
