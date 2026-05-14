import { PageHeader } from "@/components/page-header";
import { SeriesWizard } from "@/components/series-wizard";

export default function NewSeriesPage() {
  return (
    <>
      <PageHeader title="Create New Series" subtitle="Build a reusable local video recipe across niche, voice, music, art, captions, effects, and schedule." />
      <SeriesWizard />
    </>
  );
}
