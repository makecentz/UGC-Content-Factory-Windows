import { NextResponse } from "next/server";
import { createSampleUGCProject } from "@/lib/ugc/pipeline";

export async function POST() {
  const project = await createSampleUGCProject();
  return NextResponse.json(project);
}
