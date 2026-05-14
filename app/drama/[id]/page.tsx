import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DramaShortActions } from "@/components/drama-short-actions";
import { Badge, Card } from "@/components/ui";
import { formatCharacterBibleForDisplay } from "@/lib/drama/characters";
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

export default async function DramaShortDetailPage({ params }: Props) {
  const { id } = await params;
  const project = await prisma.dramaShortProject.findUnique({
    where: { id },
    include: { scenes: { orderBy: { sceneNumber: "asc" } } }
  });
  if (!project) notFound();
  const finalUrl = toPublicFileUrl(project.finalVideoPath);
  const characterBible = formatCharacterBibleForDisplay(project.characterBibleJson);

  return (
    <>
      <PageHeader
        title={project.title}
        subtitle={`YouTube Shorts · ${project.duration} · ${project.style}`}
        action={<Link href="/drama" className="rounded-xl border border-pilot-line px-4 py-2.5 text-sm font-semibold">Back to Drama Shorts</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Card>
            <div className="aspect-[9/16] overflow-hidden rounded-xl bg-pilot-soft">
              {finalUrl ? <video src={finalUrl} controls className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center p-6 text-center text-sm text-pilot-muted">No final drama short yet</div>}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Badge tone={badgeTone(project.status)}>{project.status}</Badge>
            </div>
            {project.errorMessage ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{project.errorMessage}</div> : null}
            <div className="mt-5">
              <DramaShortActions id={project.id} finalVideoPath={project.finalVideoPath} />
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-black">Short Caption</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-pilot-muted">{project.caption || "Generate the drama short to create a two-sentence caption."}</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black">Premise</h2>
                <p className="mt-2 text-sm leading-6 text-pilot-muted">{project.description}</p>
              </div>
              <Badge tone={badgeTone(project.status)}>{project.status}</Badge>
            </div>
            <div className="mt-5 grid gap-3 text-sm text-pilot-muted md:grid-cols-3">
              <div><span className="font-bold text-pilot-ink">Format:</span> 1080x1920</div>
              <div><span className="font-bold text-pilot-ink">Provider:</span> {videoProviderLabel(project.videoProvider)}</div>
              <div><span className="font-bold text-pilot-ink">Voice:</span> {project.voice}</div>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-black">Generated Script</h2>
            {project.hook ? <p className="mt-3 text-sm font-bold text-pilot-ink">{project.hook}</p> : null}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-pilot-muted">{project.script || "Generate the project to create a suspense script."}</p>
          </Card>

          <Card>
            <h2 className="text-lg font-black">Character Continuity</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-pilot-muted">{characterBible || "Generate the project to create character names, looks, wardrobe, and consistency notes."}</p>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Drama Storyboard</h2>
                <p className="mt-1 text-sm text-pilot-muted">Scenes are text-to-video clips in a vertical photorealistic suspense style.</p>
              </div>
              <DramaShortActions id={project.id} finalVideoPath={project.finalVideoPath} />
            </div>
            <div className="mt-4 space-y-4">
              {project.scenes.length === 0 ? <p className="text-sm text-pilot-muted">No drama scenes yet. Click Generate Drama Short.</p> : null}
              {project.scenes.map((scene) => {
                const clipUrl = toPublicFileUrl(scene.clipPath);
                return (
                  <div key={scene.id} className="rounded-2xl border border-pilot-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-black">Scene {scene.sceneNumber}</div>
                        <div className="mt-1 text-xs text-pilot-muted">{scene.duration}s · {videoProviderLabel(scene.provider || project.videoProvider)}</div>
                      </div>
                      <Badge tone={badgeTone(scene.status)}>{scene.status}</Badge>
                    </div>
                    {clipUrl ? <video src={clipUrl} controls className="mt-4 aspect-[9/16] w-40 rounded-xl object-cover" /> : null}
                    <p className="mt-4 text-sm leading-6 text-pilot-muted">{scene.narration}</p>
                    <div className="mt-3 grid gap-2 text-xs text-pilot-muted md:grid-cols-3">
                      <div>Camera: {scene.camera || "cinematic"}</div>
                      <div>Mood: {scene.mood || "suspense"}</div>
                      <div>Retries: {scene.retryCount}</div>
                    </div>
                    <div className="mt-3 rounded-xl bg-pilot-soft p-3 text-xs leading-5 text-pilot-muted">{scene.editedPrompt || scene.prompt}</div>
                    {scene.errorMessage ? <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{scene.errorMessage}</div> : null}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
