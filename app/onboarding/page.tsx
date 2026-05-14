import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { Card } from "@/components/ui";
import { apiKeyStatus } from "@/lib/local-config";
import { prisma } from "@/lib/prisma";
import { storagePath } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const status = apiKeyStatus();
  const settings = await prisma.settings.findFirst();
  const exportsFolder = settings?.exportsFolder || status.exportsFolder || storagePath("exports");
  const ready = status.openaiConfigured;

  if (ready) redirect("/kids");

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl items-center">
      <Card className="w-full p-8">
        <div className="inline-flex rounded-full bg-pilot-soft px-4 py-2 text-sm font-bold text-pilot-purple">Welcome to UGC Content Factory Windows</div>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-pilot-ink">Set up your AI keys to start creating videos.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-pilot-muted">
          Save your provider keys once and UGC Content Factory will reuse them after restarts. These credentials stay on this machine and can be changed later in Settings.
        </p>
        <div className="mt-6 grid gap-3 text-sm text-pilot-muted md:grid-cols-3">
          <div className="rounded-xl border border-pilot-line p-4">
            <div className="font-bold text-pilot-ink">OpenAI</div>
            <div className="mt-1">Stories, scripts, images, voice, and metadata.</div>
          </div>
          <div className="rounded-xl border border-pilot-line p-4">
            <div className="font-bold text-pilot-ink">Local ComfyUI</div>
            <div className="mt-1">Video rendering through your local Wan workflow.</div>
          </div>
          <div className="rounded-xl border border-pilot-line p-4">
            <div className="font-bold text-pilot-ink">Exports</div>
            <div className="mt-1">Choose where completed videos are saved.</div>
          </div>
        </div>
        <OnboardingForm openaiConfigured={status.openaiConfigured} googleConfigured={status.googleConfigured} exportsFolder={exportsFolder} />
      </Card>
    </div>
  );
}
