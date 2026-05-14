"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { VIDEO_PROVIDER_OPTIONS } from "@/lib/video-provider-options";
import { Button } from "./ui";

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 500) };
  }
}

export function GenerateButton({ seriesId, test = false }: { seriesId?: string; test?: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <Button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(test ? { test: true } : { seriesId })
        });
        setBusy(false);
        router.refresh();
        router.push("/videos");
      }}
    >
      {busy ? "Generating..." : test ? "Generate Test Video" : "Generate Video"}
    </Button>
  );
}

export function DeleteSeriesButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <Button
      variant="danger"
      onClick={async () => {
        if (!confirm("Delete this series and its videos?")) return;
        await fetch(`/api/series/${id}`, { method: "DELETE" });
        router.refresh();
      }}
    >
      Delete
    </Button>
  );
}

export function VideoActions({ id, filePath }: { id: string; filePath?: string | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  async function act(name: string, fn: () => Promise<void>) {
    setBusy(name);
    await fn();
    setBusy(null);
    router.refresh();
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={!filePath || busy === "open"} onClick={() => act("open", () => fetch("/api/videos/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: filePath }) }).then(() => undefined))}>
        Open file
      </Button>
      <Button variant="secondary" disabled={busy === "regen"} onClick={() => act("regen", () => fetch(`/api/videos/${id}`, { method: "POST" }).then(() => undefined))}>
        Regenerate
      </Button>
      <Button variant="secondary" disabled={busy === "posted"} onClick={() => act("posted", () => fetch(`/api/videos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "posted" }) }).then(() => undefined))}>
        Mark as Posted
      </Button>
      <Button variant="danger" disabled={busy === "delete"} onClick={() => act("delete", () => fetch(`/api/videos/${id}`, { method: "DELETE" }).then(() => undefined))}>
        Delete
      </Button>
    </div>
  );
}

export function RenderFinalButton({ videoId, allScenesReady }: { videoId: string; allScenesReady: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <Button
      disabled={busy}
      onClick={async () => {
        if (!allScenesReady && !confirm("Some scenes are not approved or ready. Render using only ready/approved scenes?")) return;
        setBusy(true);
        await fetch(`/api/videos/${videoId}/render-final`, { method: "POST" });
        setBusy(false);
        router.refresh();
      }}
    >
      {busy ? "Rendering..." : "Render Final Video"}
    </Button>
  );
}

export function SettingsAction({ action, label }: { action: string; label: string }) {
  const [message, setMessage] = useState("");
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary"
        onClick={async () => {
          setMessage("Running...");
          const response = await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action })
          });
          const data = await response.json();
          setMessage(data.message ?? (data.ok || data.installed ? "Looks good." : "Something needs attention."));
        }}
      >
        {label}
      </Button>
      {message ? <span className="text-sm text-pilot-muted">{message}</span> : null}
    </div>
  );
}

export function DebugLogActions() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState("");

  async function run(action: string) {
    setBusy(action);
    setMessage("Running...");
    setDetails("");
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const data = await readJsonResponse(response);
    setBusy(null);
    setMessage(data.message || (response.ok ? "Done." : "Action failed."));
    if (data.diagnostics) {
      setDetails(JSON.stringify(data.diagnostics, null, 2));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" disabled={busy === "open-logs"} onClick={() => run("open-logs")}>
          {busy === "open-logs" ? "Opening..." : "Open Logs Folder"}
        </Button>
        <Button type="button" variant="secondary" disabled={busy === "diagnostics"} onClick={() => run("diagnostics")}>
          {busy === "diagnostics" ? "Loading..." : "Show Diagnostics"}
        </Button>
      </div>
      {message ? <p className="text-sm text-pilot-muted">{message}</p> : null}
      {details ? (
        <textarea
          readOnly
          value={details}
          className="min-h-72 w-full rounded-xl border border-pilot-line bg-pilot-soft p-3 font-mono text-xs leading-5 text-pilot-ink outline-none"
        />
      ) : null}
    </div>
  );
}

export function ApiKeySettings({
  openaiConfigured,
  exportsFolder
}: {
  openaiConfigured: boolean;
  exportsFolder: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const formElement = event.currentTarget;
        setBusy(true);
        setMessage("Saving...");
        const form = new FormData(formElement);
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save-api-keys",
            openaiApiKey: String(form.get("openaiApiKey") || "").trim(),
            exportsFolder: String(form.get("exportsFolder") || "").trim()
          })
        });
        const data = await response.json();
        setBusy(false);
        setMessage(data.message || (response.ok ? "Saved." : "Could not save settings."));
        if (response.ok && data.ok) {
          formElement.reset();
          router.refresh();
        }
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">
          OpenAI API key
          <input
            name="openaiApiKey"
            type="password"
            placeholder={openaiConfigured ? "Configured - enter a new key to replace" : "Paste OpenAI key"}
            className="mt-2 h-11 w-full rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple"
          />
        </label>
      </div>
      <div className="grid gap-3 text-xs leading-5 text-pilot-muted md:grid-cols-2">
        <ApiKeyHelpLink
          label="OpenAI"
          href="https://platform.openai.com/api-keys"
          tooltip="Create an OpenAI API key for scripts, storyboards, images, and OpenAI voice generation."
        >
          Get an OpenAI key from the OpenAI API keys page.
        </ApiKeyHelpLink>
      </div>
      <label className="block text-sm font-semibold">
        Default export folder
        <input
          name="exportsFolder"
          defaultValue={exportsFolder}
          placeholder="Default ReelPilot export folder"
          className="mt-2 h-11 w-full rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy}>{busy ? "Saving..." : "Save API Keys & Export Folder"}</Button>
        <span className="text-sm text-pilot-muted">OpenAI: {openaiConfigured ? "Configured" : "Missing"}</span>
      </div>
      {message ? <p className="text-sm text-pilot-muted">{message}</p> : null}
    </form>
  );
}

function ApiKeyHelpLink({
  label,
  href,
  tooltip,
  children
}: {
  label: string;
  href: string;
  tooltip: string;
  children: ReactNode;
}) {
  return (
    <p>
      <span className="font-bold text-pilot-ink">{label}: </span>
      {children}{" "}
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title={`Open ${label} key page in your browser`}
        className="font-bold text-pilot-purple underline underline-offset-4"
      >
        Open link
      </a>
      <span className="group relative ml-2 inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-pilot-line text-[11px] font-black text-pilot-purple" title={tooltip}>
        ?
        <span className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-64 -translate-x-1/2 rounded-lg bg-pilot-ink px-3 py-2 text-left text-xs font-medium leading-5 text-white shadow-xl group-hover:block">
          {tooltip}
        </span>
      </span>
    </p>
  );
}

export function SceneActions({ id, prompt }: { id: string; prompt: string }) {
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(prompt);
  const router = useRouter();

  return (
    <div className="space-y-3">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="min-h-24 w-full rounded-xl border border-pilot-line p-3 text-xs leading-5 outline-none focus:border-pilot-purple"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await fetch(`/api/scenes/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: draft })
            });
            setBusy(false);
            router.refresh();
          }}
        >
          Edit prompt
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await fetch(`/api/scenes/${id}/regenerate`, { method: "POST" });
            setBusy(false);
            router.refresh();
          }}
        >
          Regenerate With Edited Prompt
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await fetch(`/api/scenes/${id}/approve`, { method: "POST" });
            setBusy(false);
            router.refresh();
          }}
        >
          Approve Scene
        </Button>
      </div>
    </div>
  );
}

export function WatermarkSettings({
  enabled,
  position,
  opacity
}: {
  enabled: boolean;
  position: string;
  opacity: number;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("Saving...");
        const formData = new FormData(event.currentTarget);
        const response = await fetch("/api/settings/watermark", { method: "POST", body: formData });
        const data = await response.json();
        setBusy(false);
        setMessage(data.id ? "Watermark settings saved." : "Could not save watermark settings.");
        router.refresh();
      }}
    >
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input name="enabled" type="checkbox" value="true" defaultChecked={enabled} />
        Enable watermark
      </label>
      <input name="file" type="file" accept="image/png" className="block w-full text-sm text-pilot-muted" />
      <label className="block text-sm font-semibold">
        Position
        <select name="position" defaultValue={position} className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm">
          <option value="bottom-right">bottom-right</option>
          <option value="bottom-center">bottom-center</option>
          <option value="top-right">top-right</option>
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Opacity
        <input name="opacity" type="number" min="0" max="1" step="0.05" defaultValue={opacity} className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm" />
      </label>
      <div className="flex items-center gap-3">
        <Button disabled={busy}>{busy ? "Saving..." : "Save Watermark"}</Button>
        {message ? <span className="text-sm text-pilot-muted">{message}</span> : null}
      </div>
    </form>
  );
}

export function ComfySettings({
  settings
}: {
  settings: {
    comfyEnabled?: boolean;
    comfyServerUrl?: string;
    comfyWanVersion?: string;
    comfyWorkflowType?: string;
    comfyWorkflowPath?: string | null;
    comfyNodeMapJson?: string | null;
    comfyInstallFolder?: string | null;
    comfyPythonPath?: string | null;
    comfyLaunchCommand?: string | null;
    comfyAutoStart?: boolean;
    comfyLocalDraftMode?: boolean;
    comfyFallbackProvider?: string | null;
    comfyDefaultWidth?: number;
    comfyDefaultHeight?: number;
    comfyDefaultFrames?: number;
    comfyDefaultFps?: number;
    comfyDefaultSteps?: number;
    comfyDefaultGuidance?: number;
    comfySeedMode?: string;
    comfyTimeoutMinutes?: number;
  } | null;
}) {
  const [message, setMessage] = useState("");
  const [scanDetails, setScanDetails] = useState<Array<{ nodeId: string; classType: string; reason: string }>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const nodeMap =
    settings?.comfyNodeMapJson ||
    JSON.stringify(
      {
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
      },
      null,
      2
    );

  async function post(action: string, data?: Record<string, unknown>) {
    setBusy(action);
    setMessage(action === "local-wan" ? "Submitting local Wan test render..." : "Working...");
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data })
    });
    const result = await readJsonResponse(response);
    setBusy(null);
    setMessage(result.message || result.error || "Done.");
    setScanDetails(Array.isArray(result.forbiddenNodes) ? result.forbiddenNodes : []);
    router.refresh();
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        post("save-comfy", {
          comfyEnabled: form.get("comfyEnabled") === "true",
          comfyServerUrl: String(form.get("comfyServerUrl") || "http://127.0.0.1:8188"),
          comfyWanVersion: String(form.get("comfyWanVersion") || "wan22"),
          comfyWorkflowType: String(form.get("comfyWorkflowType") || "text-to-video"),
          comfyWorkflowPath: String(form.get("comfyWorkflowPath") || ""),
          comfyNodeMapJson: String(form.get("comfyNodeMapJson") || ""),
          comfyInstallFolder: String(form.get("comfyInstallFolder") || ""),
          comfyPythonPath: String(form.get("comfyPythonPath") || ""),
          comfyLaunchCommand: String(form.get("comfyLaunchCommand") || ""),
          comfyAutoStart: form.get("comfyAutoStart") === "true",
          comfyLocalDraftMode: form.get("comfyLocalDraftMode") === "true",
          comfyFallbackProvider: String(form.get("comfyFallbackProvider") || "veo3"),
          comfyDefaultWidth: Number(form.get("comfyDefaultWidth") || 576),
          comfyDefaultHeight: Number(form.get("comfyDefaultHeight") || 1024),
          comfyDefaultFrames: Number(form.get("comfyDefaultFrames") || 81),
          comfyDefaultFps: Number(form.get("comfyDefaultFps") || 16),
          comfyDefaultSteps: Number(form.get("comfyDefaultSteps") || 20),
          comfyDefaultGuidance: Number(form.get("comfyDefaultGuidance") || 5),
          comfySeedMode: String(form.get("comfySeedMode") || "random"),
          comfyTimeoutMinutes: Number(form.get("comfyTimeoutMinutes") || 45)
        });
      }}
    >
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <div className="font-black">Important</div>
        <p className="mt-1">Comfy Local will not use bundled Wan API workflows. Select an exported local Wan workflow that loads model files from your ComfyUI/models folder.</p>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold"><input name="comfyEnabled" type="checkbox" value="true" defaultChecked={settings?.comfyEnabled ?? false} /> Enable Local ComfyUI</label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">Server URL<input name="comfyServerUrl" defaultValue={settings?.comfyServerUrl || "http://127.0.0.1:8188"} className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm" /></label>
        <label className="text-sm font-semibold">Active Wan Version<select name="comfyWanVersion" defaultValue={settings?.comfyWanVersion || "wan22"} className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm"><option value="wan21">Wan 2.1</option><option value="wan22">Wan 2.2</option></select></label>
        <label className="text-sm font-semibold">Workflow Type<select name="comfyWorkflowType" defaultValue={settings?.comfyWorkflowType || "text-to-video"} className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm"><option value="text-to-video">Text-to-Video</option><option value="image-to-video">Image-to-Video</option><option value="custom-workflow">Custom</option></select><span className="mt-1 block text-xs font-normal leading-5 text-pilot-muted">Use Text-to-Video for first tests. Image-to-Video workflows may run face or product consistency checks.</span></label>
        <label className="text-sm font-semibold">Local workflow JSON path<input name="comfyWorkflowPath" defaultValue={settings?.comfyWorkflowPath || ""} placeholder="C:\\ComfyUI\\workflows\\wan22-local-api.json" className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm" /><span className="mt-1 block text-xs font-normal leading-5 text-pilot-muted">Required for Comfy Local. Leave cloud/API-node workflows out of this field.</span></label>
        <label className="text-sm font-semibold">ComfyUI install folder<input name="comfyInstallFolder" defaultValue={settings?.comfyInstallFolder || ""} placeholder="/Users/you/ComfyUI" className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm" /></label>
        <label className="text-sm font-semibold">Python executable path<input name="comfyPythonPath" defaultValue={settings?.comfyPythonPath || ""} placeholder="/opt/homebrew/bin/python3" className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm" /></label>
        <label className="text-sm font-semibold md:col-span-2">Launch command<input name="comfyLaunchCommand" defaultValue={settings?.comfyLaunchCommand || "python main.py --listen 127.0.0.1 --port 8188"} className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm" /></label>
        <label className="text-sm font-semibold">Width<input name="comfyDefaultWidth" type="number" defaultValue={settings?.comfyDefaultWidth ?? 576} className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm" /></label>
        <label className="text-sm font-semibold">Height<input name="comfyDefaultHeight" type="number" defaultValue={settings?.comfyDefaultHeight ?? 1024} className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm" /></label>
        <label className="text-sm font-semibold">Frames<input name="comfyDefaultFrames" type="number" defaultValue={settings?.comfyDefaultFrames ?? 81} className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm" /></label>
        <label className="text-sm font-semibold">FPS<input name="comfyDefaultFps" type="number" defaultValue={settings?.comfyDefaultFps ?? 16} className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm" /></label>
        <label className="text-sm font-semibold">Steps<input name="comfyDefaultSteps" type="number" defaultValue={settings?.comfyDefaultSteps ?? 20} className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm" /></label>
        <label className="text-sm font-semibold">Guidance<input name="comfyDefaultGuidance" type="number" step="0.1" defaultValue={settings?.comfyDefaultGuidance ?? 5} className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm" /></label>
        <label className="text-sm font-semibold">Seed Mode<select name="comfySeedMode" defaultValue={settings?.comfySeedMode || "random"} className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm"><option value="random">random</option><option value="fixed">fixed</option></select></label>
        <label className="text-sm font-semibold">Timeout minutes<input name="comfyTimeoutMinutes" type="number" defaultValue={settings?.comfyTimeoutMinutes ?? 45} className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm" /></label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input name="comfyAutoStart" type="checkbox" value="true" defaultChecked={settings?.comfyAutoStart ?? false} /> Auto-start ComfyUI when ReelPilot opens</label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input name="comfyLocalDraftMode" type="checkbox" value="true" defaultChecked={settings?.comfyLocalDraftMode ?? false} /> Local Draft Mode (384x672 scenes, normalized later)</label>
        <label className="text-sm font-semibold md:col-span-2">Fallback if local fails<select name="comfyFallbackProvider" defaultValue={settings?.comfyFallbackProvider || "retry"} className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm"><option value="retry">Retry manually</option><option value="background">Use Animated Background Mode</option></select></label>
      </div>
      <label className="block text-sm font-semibold">Node Mapping JSON<textarea name="comfyNodeMapJson" defaultValue={nodeMap} className="mt-2 min-h-52 w-full rounded-xl border border-pilot-line p-3 font-mono text-xs" /></label>
      <div className="flex flex-wrap gap-2">
        <Button disabled={Boolean(busy)}>{busy === "save-comfy" ? "Saving..." : "Save Settings"}</Button>
        <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => post("comfy-test")}>Test Connection</Button>
        <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => post("comfy-scan")}>Scan Workflow</Button>
        <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => post("local-wan")}>Test Local Wan Render</Button>
        <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => post("comfy-start")}>Start ComfyUI</Button>
        <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => post("comfy-stop")}>Stop ComfyUI</Button>
        <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => post("comfy-restart")}>Restart ComfyUI</Button>
        <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => post("comfy-open")}>Open ComfyUI in browser</Button>
      </div>
      {message ? <p className="text-sm text-pilot-muted">{message}</p> : null}
      {scanDetails.length ? (
        <div className="rounded-2xl bg-red-50 p-4 text-sm leading-6 text-red-800">
          {scanDetails.map((node) => (
            <div key={`${node.nodeId}-${node.classType}`}>
              <span className="font-bold">Node {node.nodeId}: {node.classType}</span>
              <div>Reason: {node.reason}</div>
            </div>
          ))}
        </div>
      ) : null}
    </form>
  );
}

type WanSetupFile = {
  label: string;
  fileName: string;
  folder: string;
  targetPath: string;
  installed: boolean;
};

export function LocalVideoEngineSetup() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<{
    comfyFolder?: string;
    freeDisk?: string;
    gpu?: string;
    workflowPath?: string;
    workflowInstalled?: boolean;
    files?: WanSetupFile[];
  } | null>(null);
  const [token, setToken] = useState("");
  const router = useRouter();

  async function post(action: string) {
    setBusy(action);
    setMessage(action === "wan-setup-install" ? "Downloading Wan 2.2 files. This can take a long time..." : "Checking local video engine...");
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, huggingFaceToken: token })
    });
    const result = await readJsonResponse(response);
    setBusy(null);
    setMessage(result.message || result.error || "Done.");
    if (result.files || result.comfyFolder) setStatus(result);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-pilot-line bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-pilot-ink">Local Video Engine Setup</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-pilot-muted">
              Installs the official Wan 2.2 5B Comfy model pack into your local ComfyUI folder. The download is large, so keep the app open until it finishes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => post("wan-setup-check")}>Check Setup</Button>
            <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => post("wan-setup-prepare")}>Prepare Folders</Button>
            <Button type="button" disabled={Boolean(busy)} onClick={() => post("wan-setup-install")}>
              {busy === "wan-setup-install" ? "Installing..." : "Install Wan 2.2 5B"}
            </Button>
          </div>
        </div>
        <label className="mt-4 block text-sm font-semibold">
          Hugging Face token, optional
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            type="password"
            placeholder="Only needed if Hugging Face asks for access"
            className="mt-2 h-10 w-full rounded-xl border border-pilot-line px-3 text-sm"
          />
        </label>
        {message ? <p className="mt-3 text-sm leading-6 text-pilot-muted">{message}</p> : null}
        {status ? (
          <div className="mt-4 grid gap-3 text-sm text-pilot-muted">
            <div><span className="font-bold text-pilot-ink">ComfyUI folder:</span> {status.comfyFolder || "Not set"}</div>
            <div><span className="font-bold text-pilot-ink">Free disk:</span> {status.freeDisk || "Unknown"}</div>
            <div><span className="font-bold text-pilot-ink">GPU:</span> {status.gpu || "Unknown"}</div>
            <div><span className="font-bold text-pilot-ink">Official workflow:</span> {status.workflowInstalled ? "Downloaded" : status.workflowPath || "Not downloaded yet"}</div>
            {status.files?.length ? (
              <div className="rounded-xl border border-pilot-line bg-pilot-soft p-3">
                <div className="font-bold text-pilot-ink">Wan files</div>
                <div className="mt-2 space-y-1">
                  {status.files.map((file) => (
                    <div key={`${file.folder}-${file.fileName}`} className={file.installed ? "text-emerald-700" : "text-pilot-muted"}>
                      {file.installed ? "Installed" : "Missing"} - {file.fileName}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function UGCProjectActions({ id, finalVideoPath }: { id: string; finalVideoPath?: string | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function act(name: string, url: string, options: RequestInit = { method: "POST" }) {
    setBusy(name);
    setMessage("");
    const response = await fetch(url, options);
    const data = await readJsonResponse(response);
    setBusy(null);
    if (!response.ok || data.error) {
      setMessage(data.error || "Action failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy === "generate"} onClick={() => act("generate", `/api/ugc/${id}/generate`)}>
          {busy === "generate" ? "Generating..." : "Generate UGC Video"}
        </Button>
        <Button variant="secondary" disabled={busy === "render"} onClick={() => act("render", `/api/ugc/${id}/render`)}>
          {busy === "render" ? "Rendering..." : "Render Final Video"}
        </Button>
        <Button variant="secondary" disabled={!finalVideoPath || busy === "open"} onClick={() => act("open", "/api/videos/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: finalVideoPath }) })}>
          Open Export
        </Button>
        <Button variant="danger" disabled={busy === "delete"} onClick={() => {
          if (!confirm("Delete this UGC project?")) return;
          act("delete", `/api/ugc/${id}`, { method: "DELETE" }).then(() => router.push("/ugc"));
        }}>
          Delete Project
        </Button>
      </div>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
    </div>
  );
}

export function UGCSceneActions({ id, prompt }: { id: string; prompt: string }) {
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(prompt);
  const router = useRouter();

  async function call(url: string, options: RequestInit = { method: "POST" }) {
    setBusy(true);
    await fetch(url, options);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="min-h-24 w-full rounded-xl border border-pilot-line p-3 text-xs leading-5 outline-none focus:border-pilot-purple"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            call(`/api/ugc-scenes/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: draft })
            })
          }
        >
          Edit Prompt
        </Button>
        <Button disabled={busy} onClick={() => call(`/api/ugc-scenes/${id}/regenerate`)}>
          Regenerate Scene
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => call(`/api/ugc-scenes/${id}/approve`)}>
          Approve Scene
        </Button>
      </div>
    </div>
  );
}

export function UGCCreateForm() {
  const [busy, setBusy] = useState(false);
  const [briefBusy, setBriefBusy] = useState(false);
  const [scrapeBusy, setScrapeBusy] = useState(false);
  const [scrapeMessage, setScrapeMessage] = useState("");
  const [createMessage, setCreateMessage] = useState("");
  const [brief, setBrief] = useState("");
  const router = useRouter();

  function setFormValue(form: HTMLFormElement, name: string, value?: string) {
    const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
    if (field && typeof value === "string") field.value = value;
  }

  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setCreateMessage("Creating project...");
        const formData = new FormData(event.currentTarget);
        const response = await fetch("/api/ugc/create", { method: "POST", body: formData });
        const data = await readJsonResponse(response);
        setBusy(false);
        if (!response.ok || !data.id) {
          setCreateMessage(data.error || "Could not create the UGC project. Check required fields and image sizes.");
          return;
        }
        setCreateMessage("");
        if (data.id) router.push(`/ugc/${data.id}`);
      }}
    >
      <section className="rounded-2xl border border-pilot-line p-5">
        <h2 className="text-lg font-black">Product URL</h2>
        <p className="mt-1 text-sm text-pilot-muted">Paste a product page and let AI pre-fill the product details below.</p>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input name="productUrl" type="url" placeholder="https://example.com/product" className="h-11 flex-1 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
          <Button
            type="button"
            variant="secondary"
            disabled={scrapeBusy}
            onClick={async (event) => {
              const form = event.currentTarget.form;
              if (!form) return;
              const productUrl = (form.elements.namedItem("productUrl") as HTMLInputElement | null)?.value;
              if (!productUrl) {
                setScrapeMessage("Paste a product URL first.");
                return;
              }
              setScrapeBusy(true);
              setScrapeMessage("Reading product page...");
              const response = await fetch("/api/ugc/scrape", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: productUrl })
              });
              const data = await readJsonResponse(response);
              setScrapeBusy(false);
              if (!response.ok) {
                setScrapeMessage(data.error || "Could not read that page.");
                return;
              }
              setFormValue(form, "productName", data.product?.productName);
              setFormValue(form, "productCategory", data.product?.productCategory);
              setFormValue(form, "productDescription", data.product?.productDescription);
              setFormValue(form, "productBenefits", data.product?.productBenefits);
              setFormValue(form, "offerText", data.product?.offerText);
              setFormValue(form, "ctaText", data.product?.ctaText);
              setFormValue(form, "targetAudience", data.product?.targetAudience);
              setScrapeMessage(data.source === "ai" ? "Product fields filled with AI." : "Product fields filled from page metadata.");
            }}
          >
            {scrapeBusy ? "Scraping..." : "AI Scrape Product"}
          </Button>
        </div>
        {scrapeMessage ? <p className="mt-3 text-sm text-pilot-muted">{scrapeMessage}</p> : null}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold">Product image<input name="productImage" type="file" accept="image/*" className="mt-2 block w-full text-sm text-pilot-muted" /></label>
        <label className="block text-sm font-semibold">Creator image<input name="creatorImage" type="file" accept="image/*" className="mt-2 block w-full text-sm text-pilot-muted" /></label>
      </div>

      <section className="rounded-2xl border border-pilot-line p-5">
        <h2 className="text-lg font-black">Product</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <input name="productName" required placeholder="Product name" className="h-11 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
          <input name="productCategory" required placeholder="Product category" className="h-11 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
          <input name="offerText" placeholder="Offer / promo text" className="h-11 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
          <input name="ctaText" placeholder="CTA text" className="h-11 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
        </div>
        <textarea name="productDescription" required placeholder="Product description" className="mt-4 min-h-24 w-full rounded-xl border border-pilot-line p-3 text-sm outline-none focus:border-pilot-purple" />
        <textarea name="productBenefits" required placeholder="Key product benefits" className="mt-4 min-h-24 w-full rounded-xl border border-pilot-line p-3 text-sm outline-none focus:border-pilot-purple" />
        <input name="targetAudience" placeholder="Target audience" className="mt-4 h-11 w-full rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
      </section>

      <section className="rounded-2xl border border-pilot-line p-5">
        <h2 className="text-lg font-black">Creator</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <input name="creatorName" placeholder="Creator name optional" className="h-11 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
          <select name="creatorVibe" defaultValue="relatable" className="h-11 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple">
            {["relatable", "luxury", "energetic", "trustworthy", "funny", "direct-response", "lifestyle"].map((value) => <option key={value}>{value}</option>)}
          </select>
          <input name="creatorGender" placeholder="Creator gender optional" className="h-11 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
          <input name="creatorAgeRange" placeholder="Creator age range optional" className="h-11 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
        </div>
      </section>

      <section className="rounded-2xl border border-pilot-line p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Brief</h2>
            <p className="mt-1 text-sm text-pilot-muted">Generate a starting brief from the product details and reference images above.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={briefBusy}
            onClick={async (event) => {
              const form = event.currentTarget.form;
              if (!form) return;
              setBriefBusy(true);
              const response = await fetch("/api/ugc/brief", { method: "POST", body: new FormData(form) });
              const data = await readJsonResponse(response);
              setBrief(data.brief || "");
              setBriefBusy(false);
            }}
          >
            {briefBusy ? "Generating..." : "Generate Brief"}
          </Button>
        </div>
        <textarea
          name="brief"
          required
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          placeholder="Create a 30-second UGC ad for a skincare serum. Make it feel authentic and relatable. Show the creator holding the product, applying it, and speaking as if recommending it to friends. Focus on hydration, glow, and confidence. End with a strong shop now CTA."
          className="mt-4 min-h-36 w-full rounded-xl border border-pilot-line p-3 text-sm outline-none focus:border-pilot-purple"
        />
      </section>

      <section className="rounded-2xl border border-pilot-line p-5">
        <h2 className="text-lg font-black">Ad Settings</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <select name="duration" defaultValue="30 sec" className="h-11 rounded-xl border border-pilot-line px-3 text-sm"><option>15 sec</option><option>30 sec</option><option>45 sec</option><option>60 sec</option></select>
          <select name="platform" defaultValue="TikTok" className="h-11 rounded-xl border border-pilot-line px-3 text-sm"><option>TikTok</option><option>Instagram Reels</option><option>YouTube Shorts</option></select>
          <select name="style" defaultValue="Selfie Review" className="h-11 rounded-xl border border-pilot-line px-3 text-sm"><option>Selfie Review</option><option>Product Demo</option><option>Unboxing</option><option>Testimonial</option><option>Before & After</option><option>Lifestyle Ad</option><option>Problem / Solution</option></select>
          <select name="voice" defaultValue="Nova - energetic female" className="h-11 rounded-xl border border-pilot-line px-3 text-sm"><option>Nova - energetic female</option><option>Onyx - deep dramatic male</option><option>Sage - calm narrator</option><option>Shimmer - bright female</option><option>John - realistic male narrator</option></select>
          <select name="videoProvider" defaultValue="local-comfyui-wan22" className="h-11 rounded-xl border border-pilot-line px-3 text-sm">
            {VIDEO_PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <p className="text-xs leading-5 text-pilot-muted md:col-span-2">
            Renders through your local ComfyUI server. Configure the local workflow in Settings before generating scenes.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-5 text-sm font-semibold">
          <label className="flex items-center gap-2"><input name="captionsEnabled" type="checkbox" value="true" defaultChecked /> Captions on</label>
          <label className="flex items-center gap-2"><input name="musicEnabled" type="checkbox" value="true" /> Music on</label>
        </div>
      </section>

      <div className="space-y-3">
        <Button disabled={busy} className="w-full">{busy ? "Creating..." : "Create UGC Project"}</Button>
        {createMessage ? <p className="text-sm text-pilot-muted">{createMessage}</p> : null}
      </div>
    </form>
  );
}

export function UGCSampleButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const response = await fetch("/api/ugc/sample", { method: "POST" });
        const data = await readJsonResponse(response);
        setBusy(false);
        if (data.id) router.push(`/ugc/${data.id}`);
        else router.refresh();
      }}
    >
      {busy ? "Generating Sample..." : "Generate Sample UGC Project"}
    </Button>
  );
}
