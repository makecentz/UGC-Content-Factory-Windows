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

export function DramaShortCreateForm() {
  const [busy, setBusy] = useState(false);
  const [storyBusy, setStoryBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [storyMessage, setStoryMessage] = useState("");
  const router = useRouter();

  function setFormValue(form: HTMLFormElement, name: string, value?: string) {
    const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (field && typeof value === "string" && value.trim()) field.value = value;
  }

  async function generateStory(form: HTMLFormElement) {
    const title = (form.elements.namedItem("title") as HTMLInputElement | null)?.value.trim();
    const duration = (form.elements.namedItem("duration") as HTMLSelectElement | null)?.value;
    const style = (form.elements.namedItem("style") as HTMLSelectElement | null)?.value;
    if (!title) {
      setStoryMessage("Enter a title first.");
      return;
    }
    setStoryBusy(true);
    setStoryMessage("Creating story from title...");
    const response = await fetch("/api/drama/story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, duration, style })
    });
    const data = await readJsonResponse(response);
    setStoryBusy(false);
    if (!response.ok || data.error || !data.story) {
      setStoryMessage(data.error || "Could not generate a story from that title.");
      return;
    }
    setFormValue(form, "title", data.story.title);
    setFormValue(form, "description", data.story.description);
    setFormValue(form, "characters", data.story.characters);
    setStoryMessage(data.source === "ai" ? "Story filled from title." : "Starter story filled from title.");
  }

  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("Creating drama short...");
        const response = await fetch("/api/drama/create", { method: "POST", body: new FormData(event.currentTarget) });
        const data = await readJsonResponse(response);
        setBusy(false);
        if (!response.ok || !data.id) {
          setMessage(data.error || "Could not create the drama short.");
          return;
        }
        router.push(`/drama/${data.id}`);
      }}
    >
      <section className="rounded-2xl border border-pilot-line p-5">
        <h2 className="text-lg font-black">Drama Premise</h2>
        <div className="mt-4 grid gap-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <input name="title" placeholder="Working title optional" className="h-11 flex-1 rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple" />
            <Button
              type="button"
              variant="secondary"
              disabled={storyBusy}
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (form) generateStory(form);
              }}
            >
              {storyBusy ? "Generating..." : "Generate Story"}
            </Button>
          </div>
          {storyMessage ? <p className="text-sm text-pilot-muted">{storyMessage}</p> : null}
          <textarea
            name="description"
            required
            placeholder="A woman returns to her childhood home and discovers a voicemail from tomorrow warning her not to open the attic door."
            className="min-h-40 rounded-xl border border-pilot-line p-3 text-sm outline-none focus:border-pilot-purple"
          />
          <textarea
            name="characters"
            placeholder="Optional character continuity notes. Generate Story can fill this with names, appearance, wardrobe, and personality."
            className="min-h-32 rounded-xl border border-pilot-line p-3 text-sm outline-none focus:border-pilot-purple"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-pilot-line p-5">
        <h2 className="text-lg font-black">Short Settings</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <select name="duration" defaultValue="30 sec" className="h-11 rounded-xl border border-pilot-line px-3 text-sm">
            <option>15 sec</option>
            <option>30 sec</option>
            <option>45 sec</option>
            <option>60 sec</option>
          </select>
          <select name="voice" defaultValue="Onyx - tense narrator" className="h-11 rounded-xl border border-pilot-line px-3 text-sm">
            <option>Onyx - tense narrator</option>
            <option>Sage - quiet suspense narrator</option>
            <option>Nova - emotional narrator</option>
            <option>Echo - realistic male narrator</option>
          </select>
          <select name="style" defaultValue="8K photorealistic suspense drama" className="h-11 rounded-xl border border-pilot-line px-3 text-sm">
            <option>8K photorealistic suspense drama</option>
            <option>8K photorealistic psychological thriller</option>
            <option>8K photorealistic cinematic mystery</option>
            <option>8K photorealistic emotional betrayal drama</option>
          </select>
          <select name="videoProvider" defaultValue="local-comfyui-wan22" className="h-11 rounded-xl border border-pilot-line px-3 text-sm">
            {VIDEO_PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <p className="text-xs leading-5 text-pilot-muted md:col-span-2">
            Scene renders are sent to the local ComfyUI server configured in Settings.
          </p>
        </div>
      </section>

      <div className="space-y-3">
        <Button disabled={busy} className="w-full">{busy ? "Creating..." : "Create Drama Short"}</Button>
        {message ? <p className="text-sm text-pilot-muted">{message}</p> : null}
      </div>
    </form>
  );
}

export function DramaShortActions({ id, finalVideoPath }: { id: string; finalVideoPath?: string | null }) {
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
        <Button disabled={busy === "generate"} onClick={() => act("generate", `/api/drama/${id}/generate`)}>
          {busy === "generate" ? "Generating..." : "Generate Drama Short"}
        </Button>
        <Button variant="secondary" disabled={busy === "render"} onClick={() => act("render", `/api/drama/${id}/render`)}>
          {busy === "render" ? "Rendering..." : "Render Final"}
        </Button>
        <Button variant="secondary" disabled={!finalVideoPath || busy === "open"} onClick={() => act("open", "/api/videos/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: finalVideoPath }) })}>
          Open Export
        </Button>
        <Button
          variant="danger"
          disabled={busy === "delete"}
          onClick={() => {
            if (!confirm("Delete this drama short?")) return;
            act("delete", `/api/drama/${id}`, { method: "DELETE" }).then(() => router.push("/drama"));
          }}
        >
          Delete Short
        </Button>
      </div>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
    </div>
  );
}
