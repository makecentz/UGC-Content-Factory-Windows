import Link from "next/link";
import { Clapperboard, Download, Plus, Sparkles, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { GenerateButton } from "@/components/action-buttons";
import { PageHeader } from "@/components/page-header";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totalSeries, totalVideos, readyVideos, failedVideos, scenesGenerated, storyVideos, pendingScenes, failedScenes, latest] = await Promise.all([
    prisma.series.count(),
    prisma.video.count(),
    prisma.video.count({ where: { status: "ready" } }),
    prisma.video.count({ where: { status: "failed" } }),
    prisma.scene.count({ where: { status: "ready" } }),
    prisma.video.count({ where: { mode: "story-video" } }),
    prisma.scene.count({ where: { status: { in: ["pending", "generating"] } } }),
    prisma.scene.count({ where: { status: "failed" } }),
    prisma.video.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { series: true } })
  ]);

  const stats = [
    { label: "Total series", value: totalSeries, icon: Sparkles },
    { label: "Videos generated", value: totalVideos, icon: Clapperboard },
    { label: "Ready videos", value: readyVideos, icon: Clapperboard },
    { label: "Failed videos", value: failedVideos, icon: TriangleAlert },
    { label: "Scenes generated", value: scenesGenerated, icon: Sparkles },
    { label: "Story videos", value: storyVideos, icon: Clapperboard },
    { label: "Pending scene jobs", value: pendingScenes, icon: Sparkles },
    { label: "Failed scene jobs", value: failedScenes, icon: TriangleAlert }
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Plan faceless series, generate voiceovers, render vertical videos, and keep exports local."
        action={
          <div className="flex gap-3">
            <Link href="/series/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-pilot-purple px-4 text-sm font-semibold text-white">
              <Plus size={17} /> Create New Series
            </Link>
            <GenerateButton test />
          </div>
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

      <Card className="mt-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <img src="/reelpilot-logo.png" alt="UGC Content Factory logo" className="h-16 w-16 rounded-2xl border border-pilot-line object-cover" />
            <div>
              <h2 className="text-lg font-black">MacBook Installer</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-pilot-muted">Download the packaged Windows installer with bundled FFmpeg, FFprobe, yt-dlp, and local database setup.</p>
            </div>
          </div>
          <a href="/api/downloads/mac-installer" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-pilot-purple px-4 text-sm font-semibold text-white">
            <Download size={17} /> Download Mac Installer
          </a>
        </div>
      </Card>

      <Card className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">Latest generated videos</h2>
          <Link href="/videos" className="text-sm font-semibold text-pilot-purple">View all</Link>
        </div>
        <div className="divide-y divide-pilot-line">
          {latest.length === 0 ? <p className="py-8 text-sm text-pilot-muted">No videos yet. Generate a test video when OpenAI and FFmpeg are ready.</p> : null}
          {latest.map((video) => (
            <div key={video.id} className="flex items-center justify-between gap-4 py-4">
              <div>
                <div className="font-semibold">{video.title}</div>
                <div className="text-sm text-pilot-muted">{video.series.name}</div>
              </div>
              <Badge tone={video.status === "ready" ? "ready" : video.status === "failed" ? "failed" : "generating"}>{video.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
