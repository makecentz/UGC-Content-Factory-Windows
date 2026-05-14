import { PageHeader } from "@/components/page-header";
import { VideoActions } from "@/components/action-buttons";
import { Badge, Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { toPublicFileUrl } from "@/lib/storage";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const videos = await prisma.video.findMany({ orderBy: { createdAt: "desc" }, include: { series: true } });

  return (
    <>
      <PageHeader title="Videos" subtitle="Generated videos, scripts, statuses, and local export previews." />
      <div className="grid gap-5">
        {videos.map((video) => {
          const url = toPublicFileUrl(video.finalVideoPath);
          return (
            <Card key={video.id} className="grid gap-5 lg:grid-cols-[220px_1fr]">
              <div className="aspect-[9/16] overflow-hidden rounded-xl bg-pilot-soft">
                {url && video.status === "ready" ? <video src={url} controls className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center px-5 text-center text-sm text-pilot-muted">{video.status === "failed" ? "Render failed" : "Preview appears when ready"}</div>}
              </div>
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">{video.title}</h2>
                    <p className="mt-1 text-sm text-pilot-muted">{video.series.name} · {video.mode} · {video.createdAt.toLocaleDateString()}</p>
                  </div>
                  <Badge tone={video.status === "ready" ? "ready" : video.status === "failed" ? "failed" : "generating"}>{video.status}</Badge>
                </div>
                {video.errorMessage ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{video.errorMessage}</div> : null}
                <p className="mt-4 line-clamp-4 text-sm leading-6 text-pilot-muted">{video.script || "Script will appear after generation completes."}</p>
                <div className="mt-5">
                  <VideoActions id={video.id} filePath={video.finalVideoPath} />
                  <Link href={`/videos/${video.id}`} className="mt-3 inline-flex text-sm font-semibold text-pilot-purple">Storyboard details</Link>
                </div>
              </div>
            </Card>
          );
        })}
        {videos.length === 0 ? <Card><p className="text-sm text-pilot-muted">No videos generated yet.</p></Card> : null}
      </div>
    </>
  );
}
