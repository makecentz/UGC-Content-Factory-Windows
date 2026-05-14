export type ForbiddenWorkflowNode = {
  nodeId: string;
  classType: string;
  reason: string;
};

export type WorkflowValidationResult = {
  ok: boolean;
  message: string;
  forbiddenNodes: ForbiddenWorkflowNode[];
};

const forbiddenPatterns = [/WanTextToVideoApi/i, /WanImageToVideoApi/i, /WanVideoApi/i, /ComfyCloud/i, /Api/, /API/, /Cloud/i, /Login/i];

export const LOCAL_WORKFLOW_ERROR =
  "This workflow uses a cloud/API node that requires login. Please replace it with a true local Wan workflow that loads local model files.";

export const FRIENDLY_LOCAL_WAN_ERROR =
  "Your ComfyUI workflow is using a Wan API node that requires login. This is not a local render workflow. Open ComfyUI, load a local Wan 2.1 or Wan 2.2 workflow, export the API workflow JSON, and select that workflow in ReelPilot Settings.";

function nodeClassType(node: unknown) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return "";
  const record = node as Record<string, unknown>;
  return String(record.class_type || record.classType || record.type || record.name || "");
}

function blockedReason(classType: string) {
  if (!forbiddenPatterns.some((pattern) => pattern.test(classType))) return "";
  return "Requires login/API access and is not local rendering.";
}

export function isLocalWanLoginError(message: string) {
  return /Unauthorized|Please login first|WanTextToVideoApi|WanImageToVideoApi|WanVideoApi|ComfyCloud/i.test(message);
}

export function friendlyLocalWanError(message: string) {
  return isLocalWanLoginError(message) ? FRIENDLY_LOCAL_WAN_ERROR : message;
}

export function validateComfyWorkflowForLocalRender(workflowJson: unknown): WorkflowValidationResult {
  if (!workflowJson || typeof workflowJson !== "object" || Array.isArray(workflowJson)) {
    return { ok: false, message: "Workflow JSON must be a ComfyUI API prompt object keyed by node id.", forbiddenNodes: [] };
  }

  const forbiddenNodes = Object.entries(workflowJson as Record<string, unknown>)
    .map(([nodeId, node]) => {
      const classType = nodeClassType(node);
      const reason = blockedReason(classType);
      return reason ? { nodeId, classType, reason } : null;
    })
    .filter(Boolean) as ForbiddenWorkflowNode[];

  return {
    ok: forbiddenNodes.length === 0,
    message: forbiddenNodes.length ? LOCAL_WORKFLOW_ERROR : "Workflow looks local-ready",
    forbiddenNodes
  };
}
