import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { KidsStoryActions, KidsStoryBumperForm, KidsStoryUploadDetailsButton } from "@/components/kids-story-actions";
import { Badge, Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { toPublicFileUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function badgeTone(status: string) {
  if (["ready", "rendered", "approved"].includes(status)) return "ready" as const;
  if (status === "failed") return "failed" as const;
  if (["generating", "regenerating"].includes(status)) return "generating" as const;
  return "neutral" as const;
}

export default async function KidsStoryDetailPage({ params }: Props) {
  const { id } = await params;
  const project = await prisma.kidsStoryProject.findUnique({
    where: { id },
    include: { assets: true, scenes: { orderBy: { sceneNumber: "asc" } } }
  });
  if (!project) notFound();

  const finalUrl = toPublicFileUrl(project.finalVideoPath);
  const aspectRatio = project.aspectRatio === "9:16" ? "9:16" : "16:9";
  const previewAspectClass = aspectRatio === "9:16" ? "aspect-[9/16] max-h-[720px] w-full max-w-sm mx-auto" : "aspect-video";
  const scenePreviewClass = aspectRatio === "9:16" ? "aspect-[9/16] w-40" : "aspect-video w-72";

  return (
    <>
      <PageHeader
        title={project.title}
        subtitle={`${aspectRatio} ${aspectRatio === "9:16" ? "YouTube Shorts story" : "YouTube story"} · Ages ${project.ageRange} · ${project.duration}`}
        action={<Link href="/kids" className="rounded-xl border border-pilot-line px-4 py-2.5 text-sm font-semibold">Back to Kids Stories</Link>}
      />

      <div className="grid gap-6 xl:grid-cols-[520px_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-black">Step 1: Intro / Outro Videos</h2>
            <p className="mt-1 text-sm text-pilot-muted">Upload optional bumper videos before generating or rendering the final story.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {project.introVideoPath ? (
                <video src={toPublicFileUrl(project.introVideoPath) || ""} controls className={`${aspectRatio === "9:16" ? "aspect-[9/16] max-h-96" : "aspect-video"} w-full rounded-xl bg-pilot-soft object-cover`} />
              ) : (
                <div className={`grid ${aspectRatio === "9:16" ? "aspect-[9/16] max-h-96" : "aspect-video"} place-items-center rounded-xl bg-pilot-soft text-sm text-pilot-muted`}>No intro</div>
              )}
              {project.outroVideoPath ? (
                <video src={toPublicFileUrl(project.outroVideoPath) || ""} controls className={`${aspectRatio === "9:16" ? "aspect-[9/16] max-h-96" : "aspect-video"} w-full rounded-xl bg-pilot-soft object-cover`} />
              ) : (
                <div className={`grid ${aspectRatio === "9:16" ? "aspect-[9/16] max-h-96" : "aspect-video"} place-items-center rounded-xl bg-pilot-soft text-sm text-pilot-muted`}>No outro</div>
              )}
            </div>
            <div className="mt-4">
              <KidsStoryBumperForm id={project.id} introVideoPath={project.introVideoPath} outroVideoPath={project.outroVideoPath} />
            </div>
          </Card>

          <Card>
            <div className={`${previewAspectClass} overflow-hidden rounded-xl bg-pilot-soft`}>
              {finalUrl ? <video src={finalUrl} controls className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center p-6 text-center text-sm text-pilot-muted">No final story export yet</div>}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Badge tone={badgeTone(project.status)}>{project.status}</Badge>
            </div>
            {project.errorMessage ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{project.errorMessage}</div> : null}
            <div className="mt-5">
              <KidsStoryActions id={project.id} finalVideoPath={project.finalVideoPath} />
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-black">Manual Upload Details</h2>
            <p className="mt-1 text-sm text-pilot-muted">Use these details when you manually upload the finished video.</p>
            <div className="mt-4">
              <KidsStoryUploadDetailsButton id={project.id} />
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-sm font-bold text-pilot-ink">Video title</div>
                <div className="mt-2 rounded-xl border border-pilot-line bg-white p-3 text-sm leading-6 text-pilot-muted">{project.title}</div>
              </div>
              <div>
                <div className="text-sm font-bold text-pilot-ink">Description</div>
                <div className="mt-2 min-h-28 whitespace-pre-wrap rounded-xl border border-pilot-line bg-white p-3 text-sm leading-6 text-pilot-muted">{project.youtubeDescription || "Create upload details after the story is generated."}</div>
              </div>
              <div>
                <div className="text-sm font-bold text-pilot-ink">Tags</div>
                <div className="mt-2 rounded-xl border border-pilot-line bg-white p-3 text-sm leading-6 text-pilot-muted">{project.youtubeTags || "No tags yet"}</div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-black">Character References</h2>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {project.assets.map((asset) => {
                const url = toPublicFileUrl(asset.filePath);
                return <div key={asset.id} className="aspect-square overflow-hidden rounded-xl bg-pilot-soft">{url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}</div>;
              })}
              {project.assets.length === 0 ? <p className="col-span-3 text-sm text-pilot-muted">AI will create the characters from the story prompt.</p> : null}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black">Story Brief</h2>
                <p className="mt-2 text-sm leading-6 text-pilot-muted">{project.prompt || project.youtubeUrl || "No prompt entered."}</p>
              </div>
              <Badge tone={badgeTone(project.status)}>{project.status}</Badge>
            </div>
            <div className="mt-5 grid gap-3 text-sm text-pilot-muted md:grid-cols-3">
              <div><span className="font-bold text-pilot-ink">Theme:</span> {project.storyTheme || "auto"}</div>
              <div><span className="font-bold text-pilot-ink">Moral:</span> {project.moral || "auto"}</div>
	              <div><span className="font-bold text-pilot-ink">Provider:</span> {project.videoProvider}</div>
	              <div><span className="font-bold text-pilot-ink">Voice:</span> {project.voiceProvider}</div>
	              <div><span className="font-bold text-pilot-ink">Style:</span> {project.artStyle}</div>
	              <div><span className="font-bold text-pilot-ink">Format:</span> {aspectRatio}</div>
	            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-black">Generated Script</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-pilot-muted">{project.script || "Generate the project to create a child-safe story script."}</p>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Storyboard</h2>
	                <p className="mt-1 text-sm text-pilot-muted">Scenes render as OpenAI-generated storyboard images animated into {aspectRatio} clips. Captions and on-screen words are disabled.</p>
              </div>
              <KidsStoryActions id={project.id} finalVideoPath={project.finalVideoPath} />
            </div>
            <div className="mt-4 space-y-4">
              {project.scenes.length === 0 ? <p className="text-sm text-pilot-muted">No story scenes yet. Click Generate Story Video.</p> : null}
              {project.scenes.map((scene) => {
                const clipUrl = toPublicFileUrl(scene.clipPath);
                const imageUrl = toPublicFileUrl(scene.imagePath);
                return (
                  <div key={scene.id} className="rounded-2xl border border-pilot-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-black">Scene {scene.sceneNumber}</div>
                        <div className="mt-1 text-xs text-pilot-muted">{scene.duration}s · {scene.provider || "provider pending"}</div>
                      </div>
                      <Badge tone={badgeTone(scene.status)}>{scene.status}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
	                      {imageUrl ? <img src={imageUrl} alt="" className={`${scenePreviewClass} rounded-xl object-cover`} /> : null}
	                      {clipUrl ? <video src={clipUrl} controls className={`${scenePreviewClass} rounded-xl object-cover`} /> : null}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-pilot-muted">{scene.narration}</p>
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
