import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RenderFinalButton, SceneActions, VideoActions } from "@/components/action-buttons";
import { Badge, Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { toPublicFileUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function VideoDetailPage({ params }: Props) {
  const { id } = await params;
  const video = await prisma.video.findUnique({
    where: { id },
    include: { series: true, scenes: { orderBy: { sceneNumber: "asc" } } }
  });
  if (!video) notFound();
  const url = toPublicFileUrl(video.finalVideoPath);
  const allScenesReady = video.scenes.length > 0 && video.scenes.every((scene) => scene.approved || scene.status === "approved" || scene.status === "ready");
  const logs = video.renderLogsJson ? (JSON.parse(video.renderLogsJson) as string[]) : [];
  const providerLogs = video.scenes.length
    ? await prisma.providerJobLog.findMany({
        where: { ownerId: { in: video.scenes.map((scene) => scene.id) } },
        orderBy: { createdAt: "desc" },
        take: 10
      })
    : [];

  return (
    <>
      <PageHeader title={video.title} subtitle={`${video.series.name} · ${video.mode}`} action={<Link href="/videos" className="rounded-xl border border-pilot-line px-4 py-2.5 text-sm font-semibold">Back to Videos</Link>} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <div className="aspect-[9/16] overflow-hidden rounded-xl bg-pilot-soft">
            {url ? <video src={url} controls className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-sm text-pilot-muted">No export yet</div>}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Badge tone={video.status === "ready" ? "ready" : video.status === "failed" ? "failed" : "generating"}>{video.status}</Badge>
          </div>
          <div className="mt-5">
            <VideoActions id={video.id} filePath={video.finalVideoPath} />
            {video.mode === "story-video" ? (
              <div className="mt-3">
                <RenderFinalButton videoId={video.id} allScenesReady={allScenesReady} />
              </div>
            ) : null}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-black">Script</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-pilot-muted">{video.script || "No script saved."}</p>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Storyboard Review</h2>
                <p className="mt-1 text-sm text-pilot-muted">Review, edit, regenerate, and approve each scene before final render.</p>
              </div>
              <RenderFinalButton videoId={video.id} allScenesReady={allScenesReady} />
            </div>
            <div className="mt-4 space-y-4">
              {video.scenes.length === 0 ? <p className="text-sm text-pilot-muted">No scenes were generated for this video.</p> : null}
              {video.scenes.map((scene) => {
                const clipUrl = toPublicFileUrl(scene.clipPath);
                return (
                  <div key={scene.id} className="rounded-2xl border border-pilot-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-black">Scene {scene.sceneNumber}</div>
                        <div className="mt-1 text-xs text-pilot-muted">{scene.startTime}s-{scene.endTime}s · {scene.provider || "veo"}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {scene.approved ? <Badge tone="ready">approved</Badge> : null}
                        <Badge tone={scene.status === "ready" || scene.status === "approved" ? "ready" : scene.status === "failed" ? "failed" : "generating"}>{scene.status}</Badge>
                      </div>
                    </div>
                    {clipUrl ? <video src={clipUrl} controls className="mt-4 aspect-[9/16] w-40 rounded-xl object-cover" /> : null}
                    <p className="mt-4 text-sm leading-6 text-pilot-muted">{scene.narration}</p>
                    <div className="mt-3 grid gap-2 text-xs text-pilot-muted md:grid-cols-3">
                      <div>Duration: {scene.duration}s</div>
                      <div>Job: {scene.providerJobId || "none"}</div>
                      <div>Retries: {scene.retryCount}</div>
                    </div>
                    <div className="mt-3 rounded-xl bg-pilot-soft p-3 text-xs leading-5 text-pilot-muted">{scene.editedPrompt || scene.prompt}</div>
                    {scene.qualityReportJson ? <div className="mt-3 rounded-xl border border-pilot-line p-3 text-xs leading-5 text-pilot-muted">Quality: {JSON.parse(scene.qualityReportJson).ok ? "passed" : "needs attention"}</div> : null}
                    {scene.errorMessage ? <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{scene.errorMessage}</div> : null}
                    <div className="mt-4">
                      <SceneActions id={scene.id} prompt={scene.prompt} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-black">Render Logs</h2>
            {logs.length === 0 ? <p className="mt-3 text-sm text-pilot-muted">No render logs yet.</p> : null}
            <div className="mt-3 space-y-2">
              {logs.slice(-8).map((log, index) => (
                <div key={`${log}-${index}`} className="rounded-xl bg-pilot-soft p-3 text-xs text-pilot-muted">{log}</div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-black">Local Provider Logs</h2>
            {providerLogs.length === 0 ? <p className="mt-3 text-sm text-pilot-muted">No local provider logs yet.</p> : null}
            <div className="mt-3 space-y-2">
              {providerLogs.map((log) => (
                <div key={log.id} className="rounded-xl bg-pilot-soft p-3 text-xs leading-5 text-pilot-muted">
                  <div className="font-bold text-pilot-ink">{log.provider} · {log.status}</div>
                  <div>Prompt ID: {log.promptId || "none"}</div>
                  <div>Submitted workflow: {log.workflowPath || "none"}</div>
                  <div className="mt-2 line-clamp-3">Prompt: {log.prompt}</div>
                  {log.outputPath ? <div>Output: {log.outputPath}</div> : null}
                  {log.error ? <div className="text-red-700">{log.error}</div> : null}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
