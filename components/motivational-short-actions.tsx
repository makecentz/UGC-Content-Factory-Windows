"use client";

import { useRouter } from "next/navigation";
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

function setFormValue(form: HTMLFormElement, name: string, value?: string) {
  const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  if (field && typeof value === "string" && value.trim()) field.value = value;
}

export function MotivationalShortCreateForm() {
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState("");
  const [analyzeMessage, setAnalyzeMessage] = useState("");
  const router = useRouter();

  async function analyzeLink(form: HTMLFormElement) {
    const youtubeUrl = (form.elements.namedItem("youtubeUrl") as HTMLInputElement | null)?.value.trim();
    if (!youtubeUrl) {
      setAnalyzeMessage("Paste a YouTube link first.");
      return;
    }
    setAnalyzing(true);
    setAnalyzeMessage("Reading link and filling fields...");
    const response = await fetch("/api/motivational/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: youtubeUrl })
    });
    const data = await readJsonResponse(response);
    setAnalyzing(false);
    if (!response.ok || data.error || !data.story) {
      setAnalyzeMessage(data.error || "Could not fill the form from that link.");
      return;
    }
    setFormValue(form, "title", data.story.title);
    setFormValue(form, "prompt", data.story.prompt);
    setFormValue(form, "topic", data.story.topic);
    setFormValue(form, "tone", data.story.tone);
    setFormValue(form, "duration", data.story.duration);
    setFormValue(form, "style", data.story.style);
    setFormValue(form, "voice", data.story.voice);
    setAnalyzeMessage(data.source === "ai" ? "Fields filled from the YouTube link." : "Starter fields filled from the YouTube link.");
  }

  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("Creating motivational short...");
        const response = await fetch("/api/motivational/create", { method: "POST", body: new FormData(event.currentTarget) });
        const data = await readJsonResponse(response);
        setBusy(false);
        if (!response.ok || !data.id) {
          setMessage(data.error || "Could not create the motivational short.");
          return;
        }
        router.push(`/motivational/${data.id}`);
      }}
    >
      <section className="rounded-2xl border border-pilot-line p-5">
        <h2 className="text-lg font-black">Source</h2>
        <div className="mt-4 grid gap-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <input name="youtubeUrl" placeholder="Paste YouTube link to transcribe" className="h-11 flex-1 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
            <Button
              type="button"
              variant="secondary"
              disabled={analyzing}
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (form) analyzeLink(form);
              }}
            >
              {analyzing ? "Reading..." : "AI Fill From Link"}
            </Button>
          </div>
          {analyzeMessage ? <p className="text-sm text-pilot-muted">{analyzeMessage}</p> : null}
          <textarea
            name="pastedScript"
            placeholder="Fallback: paste the full script here if you do not want to use a YouTube transcription."
            className="min-h-36 rounded-xl border border-pilot-line p-3 text-sm outline-none focus:border-pilot-purple"
          />
          <textarea
            name="prompt"
            placeholder="Or describe the motivational video you want: discipline, comeback, confidence, faith, business, fitness, or life transformation."
            className="min-h-28 rounded-xl border border-pilot-line p-3 text-sm outline-none focus:border-pilot-purple"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-pilot-line p-5">
        <h2 className="text-lg font-black">Short Details</h2>
        <div className="mt-4 grid gap-4">
          <input name="title" placeholder="Working title" className="h-11 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
          <input name="topic" placeholder="Topic, for example discipline and resilience" className="h-11 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
          <div className="grid gap-4 md:grid-cols-2">
            <select name="duration" defaultValue="30 sec" className="h-11 rounded-xl border border-pilot-line px-3 text-sm">
              <option>15 sec</option>
              <option>30 sec</option>
              <option>45 sec</option>
              <option>60 sec</option>
            </select>
            <select name="tone" defaultValue="intense" className="h-11 rounded-xl border border-pilot-line px-3 text-sm">
              <option>intense</option>
              <option>comeback</option>
              <option>disciplined</option>
              <option>cinematic grit</option>
              <option>uplifting</option>
            </select>
            <select name="voice" defaultValue="Onyx - powerful male narrator" className="h-11 rounded-xl border border-pilot-line px-3 text-sm">
              <option>Onyx - powerful male narrator</option>
              <option>Echo - grounded male narrator</option>
              <option>Nova - inspiring female narrator</option>
            </select>
            <select name="style" defaultValue="8K photorealistic dramatic motivational cinematic video" className="h-11 rounded-xl border border-pilot-line px-3 text-sm">
              <option>8K photorealistic dramatic motivational cinematic video</option>
              <option>8K photorealistic gym discipline drama</option>
              <option>8K photorealistic entrepreneur comeback drama</option>
              <option>8K photorealistic cinematic life transformation</option>
            </select>
            <select name="videoProvider" defaultValue="local-comfyui-wan22" className="h-11 rounded-xl border border-pilot-line px-3 text-sm md:col-span-2">
              {VIDEO_PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="text-xs leading-5 text-pilot-muted md:col-span-2">
              Renders through your local ComfyUI install using the workflow configured in Settings.
            </p>
            <label className="flex h-11 items-center gap-2 rounded-xl border border-pilot-line px-3 text-sm font-semibold">
              <input name="captionsEnabled" type="checkbox" value="true" />
              Captions on
            </label>
            <select name="captionStyle" defaultValue="Bold Stroke" className="h-11 rounded-xl border border-pilot-line px-3 text-sm">
              <option>Bold Stroke</option>
              <option>Red Highlight</option>
              <option>Sleek</option>
              <option>Karaoke</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-pilot-line p-5">
        <h2 className="text-lg font-black">Watermark</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <input name="watermark" type="file" accept="image/png,image/jpeg" className="h-11 rounded-xl border border-pilot-line px-3 py-2 text-sm" />
          <select name="watermarkPosition" defaultValue="bottom-right" className="h-11 rounded-xl border border-pilot-line px-3 text-sm">
            <option value="bottom-right">Bottom right</option>
            <option value="top-left">Top left</option>
          </select>
        </div>
      </section>

      <div className="space-y-3">
        <Button disabled={busy} className="w-full">{busy ? "Creating..." : "Create Motivational Short"}</Button>
        {message ? <p className="text-sm text-pilot-muted">{message}</p> : null}
      </div>
    </form>
  );
}

export function MotivationalShortActions({ id, finalVideoPath }: { id: string; finalVideoPath?: string | null }) {
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
        <Button disabled={busy === "generate"} onClick={() => act("generate", `/api/motivational/${id}/generate`)}>
          {busy === "generate" ? "Generating..." : "Generate Motivational Short"}
        </Button>
        <Button variant="secondary" disabled={busy === "render"} onClick={() => act("render", `/api/motivational/${id}/render`)}>
          {busy === "render" ? "Rendering..." : "Render Final"}
        </Button>
        <Button variant="secondary" disabled={!finalVideoPath || busy === "open"} onClick={() => act("open", "/api/videos/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: finalVideoPath }) })}>
          Open Export
        </Button>
        <Button
          variant="danger"
          disabled={busy === "delete"}
          onClick={() => {
            if (!confirm("Delete this motivational short?")) return;
            act("delete", `/api/motivational/${id}`, { method: "DELETE" }).then(() => router.push("/motivational"));
          }}
        >
          Delete Short
        </Button>
      </div>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
    </div>
  );
}
