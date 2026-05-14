import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { GenerateButton, DeleteSeriesButton } from "@/components/action-buttons";
import { Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { videoProviderLabel } from "@/lib/video-provider-options";

export const dynamic = "force-dynamic";

export default async function SeriesPage() {
  const series = await prisma.series.findMany({
    orderBy: { createdAt: "desc" },
    include: { videos: { orderBy: { createdAt: "desc" }, take: 1 } }
  });

  return (
    <>
      <PageHeader title="Series" subtitle="Each series stores the niche, voice, visual style, captions, effects, and posting rhythm for repeatable local video generation." action={<Link href="/series/new" className="rounded-xl bg-pilot-purple px-4 py-2.5 text-sm font-semibold text-white">Create Series</Link>} />
      <div className="grid gap-5 lg:grid-cols-2">
        {series.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">{item.name}</h2>
                <p className="mt-1 text-sm text-pilot-muted">{item.customNiche || item.niche}</p>
              </div>
              <div className="rounded-full bg-pilot-soft px-3 py-1 text-xs font-bold text-pilot-purple">{item.generationMode}</div>
            </div>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div><span className="text-pilot-muted">Voice:</span> {item.voice}</div>
              <div><span className="text-pilot-muted">Art:</span> {item.artStyle}</div>
              <div><span className="text-pilot-muted">Captions:</span> {item.captionStyle}</div>
              <div><span className="text-pilot-muted">Provider:</span> {videoProviderLabel(item.videoProvider)}</div>
              <div><span className="text-pilot-muted">Last video:</span> {item.videos[0]?.title ?? "None yet"}</div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <GenerateButton seriesId={item.id} />
              <Link href="/series/new" className="inline-flex h-10 items-center justify-center rounded-xl border border-pilot-line px-4 text-sm font-semibold">Edit</Link>
              <DeleteSeriesButton id={item.id} />
            </div>
          </Card>
        ))}
        {series.length === 0 ? <Card><p className="text-sm text-pilot-muted">No series yet. Create your first one or generate a test video from the dashboard.</p></Card> : null}
      </div>
    </>
  );
}
