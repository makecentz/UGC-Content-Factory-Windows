import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { UGCProjectActions, UGCSceneActions } from "@/components/action-buttons";
import { Badge, Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { toPublicFileUrl } from "@/lib/storage";
import { videoProviderLabel } from "@/lib/video-provider-options";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function badgeTone(status: string) {
  if (["ready", "rendered", "approved"].includes(status)) return "ready" as const;
  if (status === "failed") return "failed" as const;
  if (["generating", "regenerating"].includes(status)) return "generating" as const;
  return "neutral" as const;
}

export default async function UGCProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const project = await prisma.uGCProject.findUnique({
    where: { id },
    include: { assets: true, scenes: { orderBy: { sceneNumber: "asc" } } }
  });
  if (!project) notFound();

  const productImage = project.assets.find((asset) => asset.type === "product-image");
  const creatorImage = project.assets.find((asset) => asset.type === "creator-image");
  const finalUrl = toPublicFileUrl(project.finalVideoPath);
  const productUrl = toPublicFileUrl(productImage?.filePath);
  const creatorUrl = toPublicFileUrl(creatorImage?.filePath);
  const providerLogs = project.scenes.length
    ? await prisma.providerJobLog.findMany({
        where: { ownerId: { in: project.scenes.map((scene) => scene.id) } },
        orderBy: { createdAt: "desc" },
        take: 10
      })
    : [];

  return (
    <>
      <PageHeader
        title={project.title}
        subtitle={`${project.productName} · ${project.platform} · ${project.duration}`}
        action={<Link href="/ugc" className="rounded-xl border border-pilot-line px-4 py-2.5 text-sm font-semibold">Back to UGC Studio</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Card>
            <div className="aspect-[9/16] overflow-hidden rounded-xl bg-pilot-soft">
              {finalUrl ? <video src={finalUrl} controls className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center p-6 text-center text-sm text-pilot-muted">No final UGC export yet</div>}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Badge tone={badgeTone(project.status)}>{project.status}</Badge>
            </div>
            {project.errorMessage ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{project.errorMessage}</div> : null}
            <div className="mt-5">
              <UGCProjectActions id={project.id} finalVideoPath={project.finalVideoPath} />
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-black">References</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="mb-2 text-xs font-bold text-pilot-muted">Product</div>
                <div className="aspect-square overflow-hidden rounded-xl bg-pilot-soft">{productUrl ? <img src={productUrl} alt="" className="h-full w-full object-cover" /> : null}</div>
              </div>
              <div>
                <div className="mb-2 text-xs font-bold text-pilot-muted">Creator</div>
                <div className="aspect-square overflow-hidden rounded-xl bg-pilot-soft">{creatorUrl ? <img src={creatorUrl} alt="" className="h-full w-full object-cover" /> : null}</div>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-pilot-muted">UGC visuals are AI-generated from your reference images and brief. Exact facial or packaging consistency may vary by provider.</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black">Project Brief</h2>
                <p className="mt-2 text-sm leading-6 text-pilot-muted">{project.brief}</p>
              </div>
              <Badge tone={badgeTone(project.status)}>{project.status}</Badge>
            </div>
            <div className="mt-5 grid gap-3 text-sm text-pilot-muted md:grid-cols-3">
              <div><span className="font-bold text-pilot-ink">Category:</span> {project.productCategory}</div>
              <div><span className="font-bold text-pilot-ink">Style:</span> {project.style}</div>
              <div><span className="font-bold text-pilot-ink">Voice:</span> {project.voice}</div>
              <div><span className="font-bold text-pilot-ink">Creator vibe:</span> {project.creatorVibe || project.tone}</div>
              <div><span className="font-bold text-pilot-ink">Provider:</span> {videoProviderLabel(project.videoProvider)}</div>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-black">Generated Script</h2>
            {project.hook ? <p className="mt-3 text-sm font-bold text-pilot-ink">{project.hook}</p> : null}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-pilot-muted">{project.script || "Generate the project to create a UGC script."}</p>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">UGC Storyboard Review</h2>
                <p className="mt-1 text-sm text-pilot-muted">Edit weak prompts, regenerate individual scenes, approve the good ones, then render the final ad.</p>
              </div>
              <UGCProjectActions id={project.id} finalVideoPath={project.finalVideoPath} />
            </div>
            <div className="mt-4 space-y-4">
              {project.scenes.length === 0 ? <p className="text-sm text-pilot-muted">No UGC scenes yet. Click Generate UGC Video to build the storyboard and clips.</p> : null}
              {project.scenes.map((scene) => {
                const clipUrl = toPublicFileUrl(scene.clipPath);
                return (
                  <div key={scene.id} className="rounded-2xl border border-pilot-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-black">Scene {scene.sceneNumber}</div>
                        <div className="mt-1 text-xs text-pilot-muted">{scene.shotType || "UGC shot"} · {scene.duration}s · {videoProviderLabel(scene.provider || project.videoProvider)}</div>
                      </div>
                      <div className="flex gap-2">
                        {scene.approved ? <Badge tone="ready">approved</Badge> : null}
                        <Badge tone={badgeTone(scene.status)}>{scene.status}</Badge>
                      </div>
                    </div>
                    {clipUrl ? <video src={clipUrl} controls className="mt-4 aspect-[9/16] w-40 rounded-xl object-cover" /> : null}
                    <p className="mt-4 text-sm leading-6 text-pilot-muted">{scene.narration}</p>
                    <div className="mt-3 grid gap-2 text-xs text-pilot-muted md:grid-cols-3">
                      <div>Camera: {scene.camera || "UGC handheld"}</div>
                      <div>Job: {scene.providerJobId || "none"}</div>
                      <div>Retries: {scene.retryCount}</div>
                    </div>
                    <div className="mt-3 rounded-xl bg-pilot-soft p-3 text-xs leading-5 text-pilot-muted">{scene.editedPrompt || scene.prompt}</div>
                    {scene.errorMessage ? <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{scene.errorMessage}</div> : null}
                    <div className="mt-4">
                      <UGCSceneActions id={scene.id} prompt={scene.editedPrompt || scene.prompt} />
                    </div>
                  </div>
                );
              })}
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
