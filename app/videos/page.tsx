import { PageHeader } from "@/components/page-header";
import { KidsStoryExportActions } from "@/components/kids-story-actions";
import { Badge, Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { toPublicFileUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const videos = await prisma.kidsStoryProject.findMany({
    where: { status: "rendered", finalVideoPath: { not: null } },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <>
      <PageHeader title="Completed Videos" subtitle="Finished kids story renders ready to preview, open, and download from your local export folder." />
      <div className="grid gap-5">
        {videos.map((project) => {
          const url = toPublicFileUrl(project.finalVideoPath);
          const thumbnailUrl = toPublicFileUrl(project.thumbnailPath);
          const thumbnailDownloadUrl = project.thumbnailPath ? `/api/videos/file?download=1&path=${encodeURIComponent(project.thumbnailPath)}` : null;
          const aspectClass = project.aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-video";
          return (
            <Card key={project.id} className="grid gap-5 lg:grid-cols-[260px_1fr]">
              <div className="space-y-4">
                <div className={`${aspectClass} overflow-hidden rounded-xl bg-pilot-soft`}>
                  {url ? <video src={url} controls className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center px-5 text-center text-sm text-pilot-muted">Preview unavailable</div>}
                </div>
                <div>
                  <div className="mb-2 text-sm font-black">Thumbnail</div>
                  <div className={`${aspectClass} overflow-hidden rounded-xl bg-pilot-soft`}>
                    {thumbnailUrl ? <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full min-h-32 place-items-center px-5 text-center text-sm text-pilot-muted">Create upload details to generate a thumbnail.</div>}
                  </div>
                  {thumbnailDownloadUrl ? (
                    <a href={thumbnailDownloadUrl} className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-pilot-line px-4 text-sm font-semibold">
                      Download Thumbnail
                    </a>
                  ) : null}
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">{project.title}</h2>
                    <p className="mt-1 text-sm text-pilot-muted">Kids Story · Ages {project.ageRange} · {project.aspectRatio} · {project.updatedAt.toLocaleDateString()}</p>
                  </div>
                  <Badge tone="ready">completed</Badge>
                </div>
                <p className="mt-4 line-clamp-4 text-sm leading-6 text-pilot-muted">{project.script || "Finished kids story export."}</p>
                {project.finalVideoPath ? <p className="mt-3 break-all rounded-xl bg-pilot-soft p-3 text-xs text-pilot-muted">{project.finalVideoPath}</p> : null}
                <div className="mt-5">
                  <KidsStoryExportActions id={project.id} finalVideoPath={project.finalVideoPath} />
                </div>
              </div>
            </Card>
          );
        })}
        {videos.length === 0 ? <Card><p className="text-sm text-pilot-muted">No completed kids story videos yet. Render a story and it will appear here.</p></Card> : null}
      </div>
    </>
  );
}
