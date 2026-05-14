import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureStorage, safeFileName, saveBuffer } from "@/lib/storage";

async function saveUpload(file: File | null, bucket: "ugc/products" | "ugc/creators", fallbackName: string) {
  if (!file || file.size === 0) return null;
  const extension = file.name.split(".").pop() || "png";
  const fileName = `${safeFileName(fallbackName)}-${Date.now()}.${extension}`;
  const path = await saveBuffer(bucket, fileName, Buffer.from(await file.arrayBuffer()));
  return { path, originalFileName: file.name };
}

export async function POST(request: Request) {
  try {
    await ensureStorage();
    const form = await request.formData();
    const productName = String(form.get("productName") || "Untitled Product");
    const title = String(form.get("title") || `${productName} UGC Ad`);
    const productImage = await saveUpload(form.get("productImage") as File | null, "ugc/products", productName);
    const creatorImage = await saveUpload(form.get("creatorImage") as File | null, "ugc/creators", String(form.get("creatorName") || "creator"));

    const project = await prisma.uGCProject.create({
      data: {
        title,
        productUrl: String(form.get("productUrl") || "") || null,
        productName,
        productCategory: String(form.get("productCategory") || "Product"),
        productDescription: String(form.get("productDescription") || ""),
        productBenefits: String(form.get("productBenefits") || ""),
        offerText: String(form.get("offerText") || "") || null,
        ctaText: String(form.get("ctaText") || "") || null,
        targetAudience: String(form.get("targetAudience") || "") || null,
        creatorName: String(form.get("creatorName") || "") || null,
        creatorVibe: String(form.get("creatorVibe") || "relatable"),
        creatorGender: String(form.get("creatorGender") || "") || null,
        creatorAgeRange: String(form.get("creatorAgeRange") || "") || null,
        tone: String(form.get("creatorVibe") || "relatable"),
        style: String(form.get("style") || "Selfie Review"),
        duration: String(form.get("duration") || "30 sec"),
        platform: String(form.get("platform") || "TikTok"),
        voice: String(form.get("voice") || "Nova - energetic female"),
        videoProvider: String(form.get("videoProvider") || "local-comfyui-wan22"),
        captionsEnabled: form.get("captionsEnabled") === "true",
        musicEnabled: form.get("musicEnabled") === "true",
        brief: String(form.get("brief") || ""),
        assets: {
          create: [
            ...(productImage ? [{ type: "product-image", filePath: productImage.path, originalFileName: productImage.originalFileName }] : []),
            ...(creatorImage ? [{ type: "creator-image", filePath: creatorImage.path, originalFileName: creatorImage.originalFileName }] : [])
          ]
        }
      }
    });

    return NextResponse.json({ id: project.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Could not create UGC project: ${message}` }, { status: 500 });
  }
}
