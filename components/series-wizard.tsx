"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Play, Upload } from "lucide-react";
import { VIDEO_PROVIDER_OPTIONS } from "@/lib/video-provider-options";
import { Button, Card, Input, Select, Textarea, cn } from "./ui";

const niches = ["Scary Stories", "Historical Figures", "Greek Mythology", "Important Events", "AI Money Tips", "Strange Facts", "Motivational Stories", "Philly History", "Business Lessons"];
const voices = ["Adam - confident male storyteller", "John - realistic male narrator", "Nova - energetic female", "Sage - calm narrator", "Onyx - deep dramatic male", "Shimmer - bright female"];
const music = ["none", "Happy Rhythm - upbeat and energetic", "Quiet Before Storm - suspenseful", "Brilliant Symphony - epic orchestral", "Breathing Shadows - dark suspense", "8-bit Slowed - retro eerie", "Deep Bass - cinematic low-end"];
const styles = ["Cinematic Realism", "Comic", "Creepy Comic", "Modern Cartoon", "3D Animation", "Documentary", "Dark Thriller", "Luxury Motivation"];
const captions = ["Bold Stroke", "Red Highlight", "Sleek", "Karaoke", "Majestic", "Beast", "Elegant", "Pixel", "Clarity"];
const effects = ["Glitch effect", "Film grain", "Animated hook", "Zoom motion", "Slow pan", "Vignette"];
const platforms = ["TikTok", "Instagram", "YouTube"];

type FormState = {
  niche: string;
  customNiche: string;
  language: string;
  voice: string;
  backgroundMusic: string;
  artStyle: string;
  captionStyle: string;
  effects: string[];
  platforms: string[];
  name: string;
  videoDuration: string;
  scheduleTime: string;
  postingFrequency: string;
  autoGenerate: boolean;
  generationMode: string;
  videoProvider: string;
  preferredSceneDuration: number;
  useSceneConsistency: boolean;
  transitionStyle: string;
  storyboardEnabled: boolean;
};

const initial: FormState = {
  niche: "Strange Facts",
  customNiche: "",
  language: "English",
  voice: "Onyx - deep dramatic male",
  backgroundMusic: "none",
  artStyle: "Cinematic Realism",
  captionStyle: "Bold Stroke",
  effects: ["Zoom motion"],
  platforms: ["TikTok"],
  name: "",
  videoDuration: "20-30 seconds",
  scheduleTime: "09:00",
  postingFrequency: "Manual only",
  autoGenerate: false,
  generationMode: "story-video",
  videoProvider: "local-comfyui-wan22",
  preferredSceneDuration: 5,
  useSceneConsistency: true,
  transitionStyle: "hard cut",
  storyboardEnabled: true
};

function ChoiceCard({ active, title, subtitle, onClick, children }: { active: boolean; title: string; subtitle?: string; onClick: () => void; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("min-h-24 rounded-2xl border p-4 text-left transition hover:border-pilot-purple", active ? "border-pilot-purple bg-purple-50" : "border-pilot-line bg-white")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold">{title}</div>
          {subtitle ? <div className="mt-1 text-sm leading-5 text-pilot-muted">{subtitle}</div> : null}
        </div>
        {active ? <Check className="text-pilot-purple" size={18} /> : null}
      </div>
      {children}
    </button>
  );
}

export function SeriesWizard() {
  const [step, setStep] = useState(1);
  const [tab, setTab] = useState<"presets" | "custom">("presets");
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const progress = (step / 9) * 100;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggle(key: "effects" | "platforms", value: string) {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value]
    }));
  }

  async function createSeries() {
    setSaving(true);
    const response = await fetch("/api/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, name: form.name || `${form.niche} Series` })
    });
    setSaving(false);
    if (response.ok) router.push("/series");
  }

  return (
    <Card className="mx-auto max-w-5xl">
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between text-sm font-semibold text-pilot-muted">
          <span>Step {step} of 9</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-pilot-soft">
          <div className="h-full rounded-full bg-pilot-purple transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {step === 1 && (
        <section>
          <h2 className="text-2xl font-black">Choose Your Niche</h2>
          <div className="my-5 flex gap-2">
            <Button variant={tab === "presets" ? "primary" : "secondary"} onClick={() => setTab("presets")}>Presets</Button>
            <Button variant={tab === "custom" ? "primary" : "secondary"} onClick={() => setTab("custom")}>Custom</Button>
          </div>
          {tab === "presets" ? <div className="grid gap-3 md:grid-cols-3">{niches.map((niche) => <ChoiceCard key={niche} title={niche} active={form.niche === niche} onClick={() => update("niche", niche)} />)}</div> : <Textarea value={form.customNiche} onChange={(event) => update("customNiche", event.target.value)} placeholder="Tell emotional 45-second stories about entrepreneurs who failed before they became successful." />}
        </section>
      )}

      {step === 2 && (
        <section>
          <h2 className="text-2xl font-black">Language & Voice</h2>
          <div className="mt-5 max-w-sm"><Select value={form.language} onChange={(event) => update("language", event.target.value)}><option>English</option><option>Spanish</option><option>French</option><option>German</option></Select></div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">{voices.map((voice) => <ChoiceCard key={voice} title={voice.split(" - ")[0]} subtitle={voice.split(" - ")[1]} active={form.voice === voice} onClick={() => update("voice", voice)}><div className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-pilot-purple"><Play size={14} /> Preview</div></ChoiceCard>)}</div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h2 className="text-2xl font-black">Background Music</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">{music.map((track) => <ChoiceCard key={track} title={track === "none" ? "No music" : track.split(" - ")[0]} subtitle={track.includes(" - ") ? track.split(" - ")[1] : "Voiceover only"} active={form.backgroundMusic === track} onClick={() => update("backgroundMusic", track)} />)}</div>
          <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-pilot-line p-4 text-sm font-semibold text-pilot-muted">
            <Upload size={18} /> Upload custom MP3
            <input type="file" accept="audio/mpeg" className="hidden" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const data = new FormData();
              data.append("file", file);
              const response = await fetch("/api/music/upload", { method: "POST", body: data });
              const json = await response.json();
              update("backgroundMusic", json.filePath);
            }} />
          </label>
        </section>
      )}

      {step === 4 && <section><h2 className="text-2xl font-black">Art Style</h2><div className="mt-5 grid gap-3 md:grid-cols-4">{styles.map((style) => <ChoiceCard key={style} title={style} subtitle="Guides prompts and background mood" active={form.artStyle === style} onClick={() => update("artStyle", style)} />)}</div></section>}
      {step === 5 && <section><h2 className="text-2xl font-black">Caption Style</h2><div className="mt-5 grid gap-3 md:grid-cols-3">{captions.map((style) => <ChoiceCard key={style} title={style} subtitle={["Bold Stroke", "Red Highlight", "Sleek", "Karaoke"].includes(style) ? "Rendered with ASS captions" : "Maps to a clean simple style"} active={form.captionStyle === style} onClick={() => update("captionStyle", style)} />)}</div></section>}
      {step === 6 && <section><h2 className="text-2xl font-black">Effects</h2><div className="mt-5 grid gap-3 md:grid-cols-3">{effects.map((effect) => <ChoiceCard key={effect} title={effect} subtitle={["Zoom motion", "Vignette", "Film grain"].includes(effect) ? "Implemented in renderer" : "Stored for future rendering"} active={form.effects.includes(effect)} onClick={() => toggle("effects", effect)} />)}</div></section>}
      {step === 7 && <section><h2 className="text-2xl font-black">Video Generation Mode</h2><div className="mt-5 grid gap-3 md:grid-cols-2"><ChoiceCard title="Story Video Mode" subtitle="Generate storyboard scenes, provider clips, then stitch the story reel." active={form.generationMode === "story-video"} onClick={() => update("generationMode", "story-video")} /><ChoiceCard title="Background Mode" subtitle="Use the stable animated background renderer with captions and voiceover." active={form.generationMode === "background"} onClick={() => update("generationMode", "background")} /></div><div className="mt-6 grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Video provider<Select className="mt-2" value={form.videoProvider} onChange={(event) => update("videoProvider", event.target.value)}>{VIDEO_PROVIDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} - {option.description}</option>)}</Select></label><label className="text-sm font-semibold">Preferred scene duration<Input className="mt-2" type="number" min={4} max={6} value={form.preferredSceneDuration} onChange={(event) => update("preferredSceneDuration", Number(event.target.value))} /></label><label className="text-sm font-semibold">Transition style<Select className="mt-2" value={form.transitionStyle} onChange={(event) => update("transitionStyle", event.target.value)}><option>hard cut</option><option>fade</option><option>zoom transition</option><option>none</option></Select></label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.useSceneConsistency} onChange={(event) => update("useSceneConsistency", event.target.checked)} /> Keep characters visually consistent across scenes</label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.storyboardEnabled} onChange={(event) => update("storyboardEnabled", event.target.checked)} /> Generate storyboard before rendering</label></div><p className="mt-3 text-xs leading-5 text-pilot-muted">Comfy Local (Wan 2.2) uses the local ComfyUI server and workflow selected in Settings.</p></section>}
      {step === 8 && <section><h2 className="text-2xl font-black">Connect Social Accounts</h2><div className="mt-5 grid gap-3 md:grid-cols-3">{platforms.map((platform) => <Card key={platform} className="shadow-none"><div className="font-bold">{platform}</div><div className="mt-2 text-sm text-pilot-muted">Status: Not connected</div><Button className="mt-4" variant="secondary" disabled>Coming Soon</Button><p className="mt-3 text-sm leading-5 text-pilot-muted">For MVP, ReelPilot exports ready-to-upload videos. Direct upload will be added later.</p><label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.platforms.includes(platform)} onChange={() => toggle("platforms", platform)} /> Mark this series for {platform}</label></Card>)}</div></section>}
      {step === 9 && <section><h2 className="text-2xl font-black">Series Details</h2><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Series name<Input className="mt-2" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Midnight Strange Facts" /></label><label className="text-sm font-semibold">Video duration<Select className="mt-2" value={form.videoDuration} onChange={(event) => update("videoDuration", event.target.value)}><option>20-30 seconds</option><option>30-40 seconds</option><option>45-60 seconds</option><option>60-90 seconds</option></Select></label><label className="text-sm font-semibold">Schedule time<Input className="mt-2" type="time" value={form.scheduleTime} onChange={(event) => update("scheduleTime", event.target.value)} /></label><label className="text-sm font-semibold">Posting frequency<Select className="mt-2" value={form.postingFrequency} onChange={(event) => update("postingFrequency", event.target.value)}><option>Manual only</option><option>3 times per week</option><option>Every day</option><option>2 times per day</option></Select></label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.autoGenerate} onChange={(event) => update("autoGenerate", event.target.checked)} /> Auto-generate videos ahead of schedule</label></div></section>}

      <div className="mt-8 flex justify-between">
        <Button variant="secondary" disabled={step === 1} onClick={() => setStep((current) => current - 1)}>Back</Button>
        {step < 9 ? <Button onClick={() => setStep((current) => current + 1)}>Next</Button> : <Button disabled={saving} onClick={createSeries}>{saving ? "Creating..." : "Create Series"}</Button>}
      </div>
    </Card>
  );
}
