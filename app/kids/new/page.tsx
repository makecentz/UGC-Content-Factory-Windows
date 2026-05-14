import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { KidsStoryCreateForm } from "@/components/kids-story-actions";
import { Card } from "@/components/ui";

export default function NewKidsStoryPage() {
  return (
    <>
	      <PageHeader
	        title="Create Kids Story"
	        subtitle="Start from a YouTube link, a prompt, or character references, then generate a 16:9 or 9:16 story video with voiceover and no on-screen words."
        action={<Link href="/kids" className="rounded-xl border border-pilot-line px-4 py-2.5 text-sm font-semibold">Back to Kids Stories</Link>}
      />
      <div className="mx-auto max-w-5xl">
        <Card>
          <KidsStoryCreateForm />
        </Card>
      </div>
    </>
  );
}
