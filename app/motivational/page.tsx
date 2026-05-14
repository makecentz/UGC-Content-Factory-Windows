import Link from "next/link";
import { Flame, Plus, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MotivationalShortActions } from "@/components/motivational-short-actions";
import { Badge, Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { videoProviderLabel } from "@/lib/video-provider-options";

export const dynamic = "force-dynamic";

function badgeTone(status: string) {
  if (["ready", "rendered"].includes(status)) return "ready" as const;
  if (status === "failed") return "failed" as const;
  if (["generating", "regenerating"].includes(status)) return "generating" as const;
  return "neutral" as const;
}

export default async function MotivationalShortsPage() {
  const [projects, draft, generating, failed, rendered] = await Promise.all([
    prisma.motivationalShortProject.findMany({ orderBy: { createdAt: "desc" }, take: 24 }),
    prisma.motivationalShortProject.count({ where: { status: "draft" } }),
    prisma.motivationalShortProject.count({ where: { status: "generating" } }),
    prisma.motivationalShortProject.count({ where: { status: "failed" } }),
    prisma.motivationalShortProject.count({ where: { status: "rendered" } })
  ]);
  const stats = [
    { label: "Draft", value: draft, icon: Flame },
    { label: "Generating", value: generating, icon: Flame },
    { label: "Failed", value: failed, icon: TriangleAlert },
    { label: "Rendered", value: rendered, icon: Flame }
  ];

  return (
    <>
      <PageHeader
        title="Motivational Shorts"
        subtitle="Create 1080x1920 motivational YouTube Shorts from a YouTube transcript, pasted script, or original prompt."
        action={
          <Link href="/motivational/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-pilot-purple px-4 text-sm font-semibold text-white">
            <Plus size={17} /> Create Motivational Short
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <stat.icon className="mb-4 text-pilot-purple" size={22} />
            <div className="text-3xl font-black">{stat.value}</div>
            <div className="mt-1 text-sm text-pilot-muted">{stat.label}</div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {projects.length === 0 ? (
          <Card className="md:col-span-2">
            <h2 className="text-lg font-black">No motivational shorts yet</h2>
            <p className="mt-3 text-sm leading-6 text-pilot-muted">Create from a YouTube link, paste your own script, or describe the message. The app will build a vertical short with voiceover and photorealistic video scenes.</p>
          </Card>
        ) : null}
        {projects.map((project) => (
          <Card key={project.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">{project.title}</h2>
                <p className="mt-1 line-clamp-3 text-sm leading-6 text-pilot-muted">{project.prompt || project.topic || project.pastedScript || project.youtubeUrl || "Motivational short"}</p>
              </div>
              <Badge tone={badgeTone(project.status)}>{project.status}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-pilot-muted">
              <div>{project.duration}</div>
              <div>{project.sourceType}</div>
              <div>{videoProviderLabel(project.videoProvider)}</div>
              <div>{project.createdAt.toLocaleDateString()}</div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/motivational/${project.id}`} className="inline-flex h-10 items-center justify-center rounded-xl border border-pilot-line px-4 text-sm font-semibold">Open Short</Link>
              <MotivationalShortActions id={project.id} finalVideoPath={project.finalVideoPath} />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
