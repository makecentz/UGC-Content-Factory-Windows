import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { UGCCreateForm } from "@/components/action-buttons";
import { Card } from "@/components/ui";

export default function NewUGCProjectPage() {
  return (
    <>
      <PageHeader
        title="Create UGC Ad"
        subtitle="Upload product and creator references, add your brief, then let ReelPilot build the ad."
        action={<Link href="/ugc" className="rounded-xl border border-pilot-line px-4 py-2.5 text-sm font-semibold">Back to UGC Studio</Link>}
      />
      <div className="mx-auto max-w-5xl">
        <Card>
          <UGCCreateForm />
        </Card>
      </div>
    </>
  );
}
