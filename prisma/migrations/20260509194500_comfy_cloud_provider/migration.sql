ALTER TABLE "Settings" ADD COLUMN "comfyCloudApiKeySaved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "comfyCloudWorkflowPath" TEXT;
ALTER TABLE "Settings" ADD COLUMN "comfyCloudFallbackProvider" TEXT NOT NULL DEFAULT 'veo3';
