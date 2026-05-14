import Link from "next/link";
import { Plus, Stars } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KidsStoryActions } from "@/components/kids-story-actions";
import { Badge, Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function badgeTone(status: string) {
  if (["ready", "rendered"].includes(status)) return "ready" as const;
  if (status === "failed") return "failed" as const;
  if (status === "generating") return "generating" as const;
  return "neutral" as const;
}

export default async function KidsStoriesPage() {
  const [projects, draft, generating, rendered, failed] = await Promise.all([
    prisma.kidsStoryProject.findMany({ orderBy: { createdAt: "desc" }, take: 24 }),
    prisma.kidsStoryProject.count({ where: { status: "draft" } }),
    prisma.kidsStoryProject.count({ where: { status: "generating" } }),
    prisma.kidsStoryProject.count({ where: { status: "rendered" } }),
    prisma.kidsStoryProject.count({ where: { status: "failed" } })
  ]);

  return (
    <>
      <PageHeader
        title="Kids Stories"
        subtitle="Create original 16:9 YouTube videos or 9:16 Shorts from a prompt, YouTube source, or character references."
        action={<Link href="/kids/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-pilot-purple px-4 text-sm font-semibold text-white"><Plus size={17} /> New Story</Link>}
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[["Draft", draft], ["Generating", generating], ["Rendered", rendered], ["Failed", failed]].map(([label, value]) => (
          <Card key={label}>
            <Stars className="mb-4 text-pilot-purple" size={22} />
            <div className="text-3xl font-black">{value}</div>
            <div className="mt-1 text-sm text-pilot-muted">{label}</div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {projects.length === 0 ? (
          <Card className="md:col-span-2">
            <h2 className="text-lg font-black">No kids stories yet</h2>
            <p className="mt-3 text-sm leading-6 text-pilot-muted">Create a story from a prompt or a YouTube link. The generator rewrites source material into a new child-safe story and keeps voiceover words off the screen.</p>
          </Card>
        ) : null}
        {projects.map((project) => (
          <Card key={project.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">{project.title}</h2>
                <p className="mt-1 text-sm text-pilot-muted">{project.storyTheme || project.sourceType}</p>
              </div>
              <Badge tone={badgeTone(project.status)}>{project.status}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-pilot-muted">
              <div>{project.duration}</div>
              <div>Ages {project.ageRange}</div>
              <div>{project.artStyle}</div>
              <div>{project.createdAt.toLocaleDateString()}</div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/kids/${project.id}`} className="inline-flex h-10 items-center justify-center rounded-xl border border-pilot-line px-4 text-sm font-semibold">Open Story</Link>
              <KidsStoryActions id={project.id} finalVideoPath={project.finalVideoPath} />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
