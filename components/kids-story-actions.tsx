"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

export function KidsStoryCreateForm() {
  const [busy, setBusy] = useState(false);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [analyzeMessage, setAnalyzeMessage] = useState("");
  const [lastAnalyzedUrl, setLastAnalyzedUrl] = useState("");
  const router = useRouter();

  function setFormValue(form: HTMLFormElement, name: string, value?: string) {
    const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (field && typeof value === "string" && value.trim()) field.value = value;
  }

  async function analyzeYouTube(form: HTMLFormElement, force = false) {
    const youtubeUrl = (form.elements.namedItem("youtubeUrl") as HTMLInputElement | null)?.value.trim();
    if (!youtubeUrl || (!force && youtubeUrl === lastAnalyzedUrl)) return;
    setAnalyzeBusy(true);
    setAnalyzeMessage("Reading YouTube link...");
    const response = await fetch("/api/kids/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: youtubeUrl })
    });
    const data = await readJsonResponse(response);
    setAnalyzeBusy(false);
    if (!response.ok || !data.story) {
      setAnalyzeMessage(data.error || "Could not analyze that YouTube link.");
      return;
    }
    setFormValue(form, "title", data.story.title);
    setFormValue(form, "prompt", data.story.prompt);
    setFormValue(form, "ageRange", data.story.ageRange);
    setFormValue(form, "storyTheme", data.story.storyTheme);
    setFormValue(form, "moral", data.story.moral);
    setFormValue(form, "duration", data.story.duration);
    setFormValue(form, "artStyle", data.story.artStyle);
    setFormValue(form, "voice", data.story.voice);
    setLastAnalyzedUrl(youtubeUrl);
    setAnalyzeMessage(data.source === "ai" ? "Story fields filled with AI." : "Story fields filled from YouTube metadata.");
  }

  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("Creating story project...");
        const response = await fetch("/api/kids/create", { method: "POST", body: new FormData(event.currentTarget) });
        const data = await readJsonResponse(response);
        setBusy(false);
        if (!response.ok || !data.id) {
          setMessage(data.error || "Could not create the story project.");
          return;
        }
        router.push(`/kids/${data.id}`);
      }}
    >
      <section className="rounded-2xl border border-pilot-line p-5">
        <h2 className="text-lg font-black">Story Source</h2>
        <div className="mt-4 grid gap-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              name="youtubeUrl"
              type="url"
              placeholder="YouTube link optional"
              className="h-11 flex-1 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple"
              onBlur={(event) => analyzeYouTube(event.currentTarget.form as HTMLFormElement)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={analyzeBusy}
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (form) analyzeYouTube(form, true);
              }}
            >
              {analyzeBusy ? "Reading..." : "AI Fill From YouTube"}
            </Button>
          </div>
          {analyzeMessage ? <p className="text-sm text-pilot-muted">{analyzeMessage}</p> : null}
          <textarea name="prompt" placeholder="Or write a prompt: A shy moonbeam learns how to help lost fireflies find their way home." className="min-h-32 rounded-xl border border-pilot-line p-3 text-sm outline-none focus:border-pilot-purple" />
        </div>
      </section>

      <section className="rounded-2xl border border-pilot-line p-5">
        <h2 className="text-lg font-black">Characters</h2>
        <p className="mt-1 text-sm text-pilot-muted">Upload character references, or leave this empty and AI will create the cast.</p>
        <input name="characterImages" type="file" accept="image/*" multiple className="mt-4 block w-full text-sm text-pilot-muted" />
      </section>

      <section className="rounded-2xl border border-pilot-line p-5">
        <h2 className="text-lg font-black">Kids Video Settings</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <input name="title" placeholder="Working title" className="h-11 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
          <select name="ageRange" defaultValue="4-8" className="h-11 rounded-xl border border-pilot-line px-3 text-sm"><option>2-5</option><option>4-8</option><option>6-10</option><option>8-12</option></select>
          <input name="storyTheme" placeholder="Theme: friendship, courage, bedtime..." className="h-11 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
          <input name="moral" placeholder="Moral optional" className="h-11 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
	          <select name="duration" defaultValue="3 min" className="h-11 rounded-xl border border-pilot-line px-3 text-sm"><option>60 sec</option><option>2 min</option><option>3 min</option><option>5 min</option></select>
	          <select name="aspectRatio" defaultValue="16:9" className="h-11 rounded-xl border border-pilot-line px-3 text-sm"><option value="16:9">16:9 YouTube landscape</option><option value="9:16">9:16 YouTube Shorts vertical</option></select>
	          <select name="artStyle" defaultValue="Bright storybook animation" className="h-11 rounded-xl border border-pilot-line px-3 text-sm"><option>Bright storybook animation</option><option>Soft watercolor cartoon</option><option>Playful 3D animation</option><option>Paper cutout storybook</option><option>Cozy bedtime illustration</option></select>
          <select name="voiceProvider" defaultValue="openai" className="h-11 rounded-xl border border-pilot-line px-3 text-sm"><option value="openai">OpenAI voice</option><option value="elevenlabs">ElevenLabs voice</option></select>
          <select name="voice" defaultValue="Nova - warm storyteller" className="h-11 rounded-xl border border-pilot-line px-3 text-sm"><option>Nova - warm storyteller</option><option>Shimmer - bright storyteller</option><option>Sage - calm narrator</option><option>Fable - whimsical narrator</option></select>
          <select name="videoProvider" defaultValue="openai-image" className="h-11 rounded-xl border border-pilot-line px-3 text-sm"><option value="openai-image">OpenAI Image Storyboard</option></select>
        </div>
      </section>

      <div className="space-y-3">
        <Button disabled={busy} className="w-full">{busy ? "Creating..." : "Create Kids Story"}</Button>
        {message ? <p className="text-sm text-pilot-muted">{message}</p> : null}
      </div>
    </form>
  );
}

export function KidsStoryActions({ id, finalVideoPath }: { id: string; finalVideoPath?: string | null }) {
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
        <Button disabled={busy === "generate"} onClick={() => act("generate", `/api/kids/${id}/generate`)}>
          {busy === "generate" ? "Generating..." : "Generate Image Story Video"}
        </Button>
        <Button variant="secondary" disabled={busy === "render"} onClick={() => act("render", `/api/kids/${id}/render`)}>
          {busy === "render" ? "Rendering..." : "Render Final"}
        </Button>
        <Button variant="secondary" disabled={busy === "youtube"} onClick={() => act("youtube", `/api/kids/${id}/youtube-package`)}>
          {busy === "youtube" ? "Creating..." : "Create Upload Details"}
        </Button>
        <Button variant="secondary" disabled={!finalVideoPath || busy === "open"} onClick={() => act("open", "/api/videos/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: finalVideoPath }) })}>
          Open Export
        </Button>
        <Button
          variant="danger"
          disabled={busy === "delete"}
          onClick={() => {
            if (!confirm("Delete this kids story project?")) return;
            act("delete", `/api/kids/${id}`, { method: "DELETE" }).then(() => router.push("/kids"));
          }}
        >
          Delete Story
        </Button>
      </div>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
    </div>
  );
}

export function KidsStoryUploadDetailsButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          const response = await fetch(`/api/kids/${id}/youtube-package`, { method: "POST" });
          const data = await readJsonResponse(response);
          setBusy(false);
          if (!response.ok || data.error) {
            setMessage(data.error || "Could not create upload details.");
            return;
          }
          setMessage("Upload details are ready.");
          router.refresh();
        }}
      >
        {busy ? "Creating..." : "Create Upload Details"}
      </Button>
      {message ? <p className={`text-sm ${message.startsWith("Could") ? "text-red-700" : "text-pilot-muted"}`}>{message}</p> : null}
    </div>
  );
}

export function KidsStoryExportActions({ id }: { id: string; finalVideoPath?: string | null }) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => router.push(`/kids/${id}`)}>
        Open Export
      </Button>
    </div>
  );
}

export function KidsStoryBumperForm({
  id,
  introVideoPath,
  outroVideoPath
}: {
  id: string;
  introVideoPath?: string | null;
  outroVideoPath?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setBusy(true);
        setMessage("Uploading videos...");
        const response = await fetch(`/api/kids/${id}/bumpers`, { method: "POST", body: new FormData(form) });
        const data = await readJsonResponse(response);
        setBusy(false);
        if (!response.ok || data.error) {
          setMessage(data.error || "Could not upload intro/outro videos.");
          return;
        }
        setMessage("Intro/outro saved. Render Final will include them.");
        form.reset();
        router.refresh();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="rounded-xl border border-pilot-line p-4">
          <span className="text-sm font-bold text-pilot-ink">Intro video</span>
          <span className="mt-1 block text-xs text-pilot-muted">{introVideoPath ? "Uploaded and ready" : "Optional MP4, MOV, M4V, or WebM"}</span>
          <input name="introVideo" type="file" accept="video/mp4,video/quicktime,video/x-m4v,video/webm" className="mt-3 block w-full text-sm text-pilot-muted" />
        </label>
        <label className="rounded-xl border border-pilot-line p-4">
          <span className="text-sm font-bold text-pilot-ink">Outro video</span>
          <span className="mt-1 block text-xs text-pilot-muted">{outroVideoPath ? "Uploaded and ready" : "Optional MP4, MOV, M4V, or WebM"}</span>
          <input name="outroVideo" type="file" accept="video/mp4,video/quicktime,video/x-m4v,video/webm" className="mt-3 block w-full text-sm text-pilot-muted" />
        </label>
      </div>
      <Button variant="secondary" disabled={busy}>{busy ? "Uploading..." : "Save Intro / Outro"}</Button>
      {message ? <p className={`text-sm ${message.startsWith("Could") ? "text-red-700" : "text-pilot-muted"}`}>{message}</p> : null}
    </form>
  );
}
