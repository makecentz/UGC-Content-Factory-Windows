import Link from "next/link";
import Image from "next/image";
import { Clapperboard, Plus, Stars, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totalStories, renderedStories, generatingStories, failedStories, readyScenes, latest] = await Promise.all([
    prisma.kidsStoryProject.count(),
    prisma.kidsStoryProject.count({ where: { status: "rendered" } }),
    prisma.kidsStoryProject.count({ where: { status: "generating" } }),
    prisma.kidsStoryProject.count({ where: { status: "failed" } }),
    prisma.kidsStoryScene.count({ where: { status: "ready" } }),
    prisma.kidsStoryProject.findMany({ orderBy: { updatedAt: "desc" }, take: 5 })
  ]);

  const stats = [
    { label: "Kids stories", value: totalStories, icon: Stars },
    { label: "Completed videos", value: renderedStories, icon: Clapperboard },
    { label: "Generating", value: generatingStories, icon: Stars },
    { label: "Failed", value: failedStories, icon: TriangleAlert },
    { label: "Ready scenes", value: readyScenes, icon: Clapperboard }
  ];

  return (
    <>
      <PageHeader
        title="Kids Story Dashboard"
        subtitle="Create child-safe story videos, add intro and outro clips, render locally, and keep exports on this Windows machine."
        action={
          <div className="flex gap-3">
            <Link href="/kids/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-pilot-purple px-4 text-sm font-semibold text-white">
              <Plus size={17} /> Create Kids Story
            </Link>
          </div>
        }
      />

      <Card className="mb-8 grid gap-6 md:grid-cols-[160px_1fr]">
        <Image src="/ugccflogo.png" alt="UGC Content Factory" width={160} height={160} className="h-40 w-40 object-contain" priority />
        <div className="flex flex-col justify-center">
          <h2 className="text-2xl font-black">UGC Content Factory Kids</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-pilot-muted">
            A focused Windows studio for generating kids story videos with local project storage, bundled FFmpeg, intro/outro support, upload details, thumbnails, and completed exports.
          </p>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <stat.icon className="mb-4 text-pilot-purple" size={22} />
            <div className="text-3xl font-black">{stat.value}</div>
            <div className="mt-1 text-sm text-pilot-muted">{stat.label}</div>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">Latest kids stories</h2>
          <Link href="/kids" className="text-sm font-semibold text-pilot-purple">View all</Link>
        </div>
        <div className="divide-y divide-pilot-line">
          {latest.length === 0 ? <p className="py-8 text-sm text-pilot-muted">No stories yet. Create your first kids story to begin.</p> : null}
          {latest.map((project) => (
            <div key={project.id} className="flex items-center justify-between gap-4 py-4">
              <div>
                <Link href={`/kids/${project.id}`} className="font-semibold hover:text-pilot-purple">{project.title}</Link>
                <div className="text-sm text-pilot-muted">Ages {project.ageRange} · {project.duration} · {project.aspectRatio}</div>
              </div>
              <Badge tone={project.status === "rendered" ? "ready" : project.status === "failed" ? "failed" : project.status === "generating" ? "generating" : "neutral"}>{project.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
