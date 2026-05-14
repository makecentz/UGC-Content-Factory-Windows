import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DramaShortCreateForm } from "@/components/drama-short-actions";
import { Card } from "@/components/ui";

export default function NewDramaShortPage() {
  return (
    <>
      <PageHeader
        title="Create Drama Short"
        subtitle="Describe the drama or suspense premise, then let AI build the title, script, caption, and photorealistic vertical video."
        action={<Link href="/drama" className="rounded-xl border border-pilot-line px-4 py-2.5 text-sm font-semibold">Back to Drama Shorts</Link>}
      />
      <div className="mx-auto max-w-5xl">
        <Card>
          <DramaShortCreateForm />
        </Card>
      </div>
    </>
  );
}
