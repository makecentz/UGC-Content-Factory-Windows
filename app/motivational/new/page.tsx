import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { MotivationalShortCreateForm } from "@/components/motivational-short-actions";
import { Card } from "@/components/ui";

export default function NewMotivationalShortPage() {
  return (
    <>
      <PageHeader
        title="Create Motivational Short"
        subtitle="Paste a YouTube link for transcription, paste your own script, or describe the motivational short you want AI to create."
        action={<Link href="/motivational" className="rounded-xl border border-pilot-line px-4 py-2.5 text-sm font-semibold">Back to Motivational Shorts</Link>}
      />
      <div className="mx-auto max-w-5xl">
        <Card>
          <MotivationalShortCreateForm />
        </Card>
      </div>
    </>
  );
}
