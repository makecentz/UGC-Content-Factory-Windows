import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";

const guides = [
  ["How to create your first series", "Open Create Series, choose a niche, pick a voice and caption style, then save the series."],
  ["How to upload exported videos to TikTok", "Generate a ready video, open the MP4 from storage/exports, then upload it manually in TikTok Studio."],
  ["How to upload exported videos to Instagram Reels", "Use the exported vertical MP4 and paste ReelPilot's description and hashtags into Instagram."],
  ["How to upload exported videos to YouTube Shorts", "Upload the MP4 in YouTube Studio and keep the final video under the Shorts duration limits."],
  ["How to add your own music", "Upload an MP3 in the music step. ReelPilot stores it in storage/music and can mix it under the voiceover."],
  ["How to create your first UGC ad", "Open UGC Studio, upload a product image and creator reference, write a brief, then generate the UGC project."],
  ["Best UGC prompt practices", "Keep each scene focused on one clear action: hook, product close-up, demo, reaction, lifestyle payoff, or CTA."],
  ["How to write better product benefits", "Use specific outcomes, sensory details, and objections the ad should answer. Short bullet-style benefits work well."],
  ["How to use a creator image effectively", "Use a clear, front-facing creator reference with good lighting. ReelPilot uses it for appearance consistency, not public identity recognition."],
  ["How to regenerate weak scenes", "Open a UGC project, edit the scene prompt, regenerate only that scene, approve the best clips, then render the final ad."]
];

export default function GuidesPage() {
  return (
    <>
      <PageHeader title="Guides" subtitle="Quick local workflow notes for producing and exporting faceless videos." />
      <div className="grid gap-5 md:grid-cols-2">
        {guides.map(([title, body]) => (
          <Card key={title}>
            <h2 className="text-lg font-black">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-pilot-muted">{body}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
