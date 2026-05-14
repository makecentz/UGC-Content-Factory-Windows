import { PageHeader } from "@/components/page-header";
import { ApiKeySettings, ComfySettings, DebugLogActions, LocalVideoEngineSetup, SettingsAction, WatermarkSettings } from "@/components/action-buttons";
import { Card } from "@/components/ui";
import { apiKeyStatus } from "@/lib/local-config";
import { prisma } from "@/lib/prisma";
import { storagePath } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await prisma.settings.findFirst();
  const status = apiKeyStatus();
  const exportsFolder = settings?.exportsFolder || status.exportsFolder || storagePath("exports");
  return (
    <>
      <PageHeader title="Settings" subtitle="Local environment checks and storage paths for UGC Content Factory Windows." />
      <div className="grid gap-5">
        <Card>
          <h2 className="text-lg font-black">API Keys & Exports</h2>
          <p className="mt-2 text-sm leading-6 text-pilot-muted">Save provider keys here. New credentials apply immediately and are saved locally for restarts.</p>
          <div className="mt-4">
            <ApiKeySettings openaiConfigured={status.openaiConfigured} googleConfigured={status.googleConfigured} exportsFolder={exportsFolder} />
          </div>
        </Card>
        <Card className="space-y-4">
          <h2 className="text-lg font-black">Health checks</h2>
          <SettingsAction action="ffmpeg" label="Test FFmpeg" />
          <SettingsAction action="story-video" label="Test Story Video Mode" />
          <SettingsAction action="openai" label="Test OpenAI" />
          <SettingsAction action="google" label="Test Google/Veo" />
          <SettingsAction action="clear-temp" label="Clear temp files" />
        </Card>
        <Card>
          <h2 className="text-lg font-black">Debug Logs</h2>
          <p className="mt-2 text-sm leading-6 text-pilot-muted">Open the packaged app logs or review recent diagnostics when a render fails.</p>
          <div className="mt-4">
            <DebugLogActions />
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-black">AI Video Providers</h2>
          <div className="mt-4 grid gap-3 text-sm text-pilot-muted md:grid-cols-2">
            <div><span className="font-semibold text-pilot-ink">Active provider:</span> Local ComfyUI Wan 2.2</div>
            <div><span className="font-semibold text-pilot-ink">Runway:</span> {process.env.RUNWAY_API_KEY ? "Configured" : "Add RUNWAY_API_KEY to .env.local"}</div>
            <div><span className="font-semibold text-pilot-ink">Comfy Local:</span> {settings?.comfyEnabled ? `Enabled (${settings.comfyWanVersion === "wan21" ? "Wan 2.1" : "Wan 2.2"})` : "Available in Local ComfyUI settings"}</div>
            <div><span className="font-semibold text-pilot-ink">Veo:</span> {status.googleConfigured ? "Configured" : "Missing"}</div>
            <div><span className="font-semibold text-pilot-ink">Exports:</span> {exportsFolder}</div>
          </div>
          <p className="mt-4 text-sm leading-6 text-pilot-muted">Comfy Local with Wan 2.2 is the video render provider shown in creation flows. Select your exported local Wan workflow for best motion, or use the bundled local Comfy fallback while you set up Wan.</p>
        </Card>
        <Card>
          <h2 className="text-lg font-black">Local ComfyUI + Wan Rendering</h2>
          <p className="mt-2 text-sm leading-6 text-pilot-muted">Local Wan rendering can avoid Veo credits, but speed and quality depend on your Windows hardware. Many AI video workflows are optimized for NVIDIA CUDA GPUs, so systems without a compatible GPU may be slower or require smaller settings.</p>
          <div className="mt-4">
            <LocalVideoEngineSetup />
          </div>
          <div className="mt-4">
            <ComfySettings settings={settings} />
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-black">Watermark</h2>
          <p className="mt-2 text-sm text-pilot-muted">Upload a PNG logo and UGC Content Factory can overlay it during final story renders.</p>
          <div className="mt-4">
            <WatermarkSettings
              enabled={settings?.watermarkEnabled ?? false}
              position={settings?.watermarkPosition ?? "bottom-right"}
              opacity={settings?.watermarkOpacity ?? 0.7}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
