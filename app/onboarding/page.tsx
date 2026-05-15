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
        <div className="inline-flex rounded-full bg-pilot-soft px-4 py-2 text-sm font-bold text-pilot-purple">First-time setup</div>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-pilot-ink">Set up your kids story studio.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-pilot-muted">
          This setup task only appears when an OpenAI key has not been saved yet. UGC Content Factory keeps credentials and story files on this Windows machine.
        </p>
        <div className="mt-6 grid gap-3 text-sm text-pilot-muted md:grid-cols-3">
          <div className="rounded-xl border border-pilot-line p-4">
            <div className="font-bold text-pilot-ink">1. Add OpenAI key</div>
            <div className="mt-1">Required for stories, images, voice, thumbnails, and upload details.</div>
          </div>
          <div className="rounded-xl border border-pilot-line p-4">
            <div className="font-bold text-pilot-ink">2. Confirm exports</div>
            <div className="mt-1">Choose where completed videos are saved.</div>
          </div>
          <div className="rounded-xl border border-pilot-line p-4">
            <div className="font-bold text-pilot-ink">3. Start creating</div>
            <div className="mt-1">You can add intro/outro videos later in Settings.</div>
          </div>
        </div>
        <OnboardingForm openaiConfigured={status.openaiConfigured} exportsFolder={exportsFolder} />
      </Card>
    </div>
  );
}
