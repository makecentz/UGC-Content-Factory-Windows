import Link from "next/link";
import { Plus, WandSparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { UGCProjectActions, UGCSampleButton } from "@/components/action-buttons";
import { Badge, Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { videoProviderLabel } from "@/lib/video-provider-options";

export const dynamic = "force-dynamic";

function badgeTone(status: string) {
  if (["ready", "rendered"].includes(status)) return "ready" as const;
  if (status === "failed") return "failed" as const;
  if (status === "generating") return "generating" as const;
  return "neutral" as const;
}

export default async function UGCStudioPage() {
  const [projects, draft, generating, ready, failed, rendered] = await Promise.all([
    prisma.uGCProject.findMany({ orderBy: { createdAt: "desc" }, take: 24 }),
    prisma.uGCProject.count({ where: { status: "draft" } }),
    prisma.uGCProject.count({ where: { status: "generating" } }),
    prisma.uGCProject.count({ where: { status: "ready" } }),
    prisma.uGCProject.count({ where: { status: "failed" } }),
    prisma.uGCProject.count({ where: { status: "rendered" } })
  ]);
  const stats = [
    ["Draft", draft],
    ["Generating", generating],
    ["Ready", ready],
    ["Failed", failed],
    ["Rendered", rendered]
  ];

  return (
    <>
      <PageHeader
        title="UGC Studio"
        subtitle="Create AI-generated product ads with creator references, product shots, Veo scenes, voiceover, captions, and final export."
        action={
          <div className="flex flex-wrap gap-3">
            <UGCSampleButton />
            <Link href="/ugc/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-pilot-purple px-4 text-sm font-semibold text-white">
              <Plus size={17} /> Create New UGC Ad
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-5">
        {stats.map(([label, value]) => (
          <Card key={label}>
            <WandSparkles className="mb-4 text-pilot-purple" size={22} />
            <div className="text-3xl font-black">{value}</div>
            <div className="mt-1 text-sm text-pilot-muted">{label}</div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {projects.length === 0 ? (
          <Card className="md:col-span-2">
            <h2 className="text-lg font-black">No UGC projects yet</h2>
            <p className="mt-3 text-sm leading-6 text-pilot-muted">Start with a product image, a creator reference, and a short creative brief. UGC visuals are AI-generated from your reference images and brief. Exact facial or packaging consistency may vary by provider.</p>
          </Card>
        ) : null}
        {projects.map((project) => (
          <Card key={project.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">{project.title}</h2>
                <p className="mt-1 text-sm text-pilot-muted">{project.productName}</p>
              </div>
              <Badge tone={badgeTone(project.status)}>{project.status}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-pilot-muted">
              <div>{project.duration}</div>
              <div>{project.platform}</div>
              <div>{videoProviderLabel(project.videoProvider)}</div>
              <div>{project.createdAt.toLocaleDateString()}</div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/ugc/${project.id}`} className="inline-flex h-10 items-center justify-center rounded-xl border border-pilot-line px-4 text-sm font-semibold">Open Project</Link>
              <UGCProjectActions id={project.id} finalVideoPath={project.finalVideoPath} />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
