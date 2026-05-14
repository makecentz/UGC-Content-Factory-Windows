import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { prisma } from "@/lib/prisma";

export type ComfySubmitResult = {
  promptId: string;
};

export type ComfyFileInfo = {
  filename: string;
  subfolder?: string;
  type?: string;
};

export async function getComfyBaseUrl() {
  const settings = await prisma.settings.findFirst();
  return (settings?.comfyServerUrl || process.env.COMFYUI_SERVER_URL || "http://127.0.0.1:8188").replace(/\/$/, "");
}

async function comfyFetch(pathname: string, init?: RequestInit) {
  const base = await getComfyBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${base}${pathname}`, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `ComfyUI is not reachable at ${base}. Start ComfyUI, check Settings > ComfyUI server URL, or choose Veo 3/Mock as the video provider. ${message}`
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`ComfyUI request failed (${response.status}). ${text || "Start ComfyUI and try again."}`);
  }
  return response;
}

export async function testComfyConnection() {
  try {
    await getObjectInfo();
    return { ok: true, message: "ComfyUI connection works." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return {
      ok: false,
      message: message === "fetch failed" || message.includes("ECONNREFUSED")
        ? "ComfyUI is not running. Start ComfyUI and try again."
        : message || "ComfyUI is not running. Start ComfyUI and try again."
    };
  }
}

export async function getObjectInfo() {
  return comfyFetch("/object_info").then((response) => response.json());
}

export async function getQueue() {
  return comfyFetch("/queue").then((response) => response.json());
}

export async function submitPrompt(workflowJson: unknown, extraData?: Record<string, unknown>): Promise<ComfySubmitResult> {
  await validateNodeTypes(workflowJson);
  const response = await comfyFetch("/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflowJson, ...(extraData ? { extra_data: extraData } : {}) })
  }).then((item) => item.json());
  const promptId = response.prompt_id || response.promptId;
  if (!promptId) throw new Error("ComfyUI did not return a prompt_id.");
  return { promptId };
}

async function validateNodeTypes(workflowJson: unknown) {
  if (!workflowJson || typeof workflowJson !== "object" || Array.isArray(workflowJson)) return;
  const objectInfo = await getObjectInfo();
  const missing = Object.entries(workflowJson as Record<string, any>)
    .map(([nodeId, node]) => ({ nodeId, classType: node?.class_type }))
    .filter((node) => node.classType && !objectInfo[node.classType]);
  if (!missing.length) return;
  const first = missing[0];
  throw new Error(
    `ComfyUI workflow uses missing node type '${first.classType}' at node ${first.nodeId}. Install that custom node, or replace the workflow JSON with one exported from this ComfyUI install.`
  );
}

export async function getHistory(promptId: string) {
  return comfyFetch(`/history/${encodeURIComponent(promptId)}`).then((response) => response.json());
}

export async function waitForPromptCompletion(promptId: string, timeoutMinutes = 45) {
  const started = Date.now();
  const timeoutMs = Math.max(1, timeoutMinutes) * 60_000;
  while (Date.now() - started < timeoutMs) {
    const history = await getHistory(promptId);
    if (history?.[promptId]) return history[promptId];
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Local Wan generation exceeded the configured timeout.");
}

export function getExecutionErrorFromHistory(history: any) {
  const messages = history?.status?.messages;
  if (!Array.isArray(messages)) return "";
  const executionError = messages.find((message) => Array.isArray(message) && message[0] === "execution_error")?.[1];
  const exceptionMessage = String(executionError?.exception_message || "").trim();
  if (!exceptionMessage) return "";
  const nodeType = executionError?.node_type ? ` in ${executionError.node_type}` : "";
  const nodeId = executionError?.node_id ? ` node ${executionError.node_id}` : "";
  return `ComfyUI execution failed${nodeType}${nodeId}: ${exceptionMessage}`;
}

export function findOutputFilesFromHistory(history: any): ComfyFileInfo[] {
  const files: ComfyFileInfo[] = [];
  const outputs = history?.outputs || {};
  for (const output of Object.values(outputs) as any[]) {
    for (const key of ["gifs", "videos", "images"]) {
      const items = output?.[key];
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item?.filename) files.push({ filename: item.filename, subfolder: item.subfolder || "", type: item.type || "output" });
        }
      }
    }
  }
  return files;
}

export async function downloadOutputFile(fileInfo: ComfyFileInfo, outputPath: string) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const params = new URLSearchParams({
    filename: fileInfo.filename,
    subfolder: fileInfo.subfolder || "",
    type: fileInfo.type || "output"
  });
  const response = await comfyFetch(`/view?${params.toString()}`);
  if (!response.body) throw new Error("ComfyUI returned an empty output file stream.");
  await pipeline(response.body as any, createWriteStream(outputPath));
  return outputPath;
}
