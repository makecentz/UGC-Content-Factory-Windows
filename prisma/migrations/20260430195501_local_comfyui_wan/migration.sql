-- CreateTable
CREATE TABLE "ProviderJobLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "projectType" TEXT,
    "ownerId" TEXT,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "workflowPath" TEXT,
    "promptId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "outputPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "openaiApiKeySaved" BOOLEAN NOT NULL DEFAULT false,
    "defaultVoice" TEXT NOT NULL DEFAULT 'onyx',
    "defaultVideoDuration" TEXT NOT NULL DEFAULT '20-30 seconds',
    "exportsFolder" TEXT NOT NULL DEFAULT './storage/exports',
    "watermarkPath" TEXT,
    "watermarkEnabled" BOOLEAN NOT NULL DEFAULT false,
    "watermarkPosition" TEXT NOT NULL DEFAULT 'bottom-right',
    "watermarkOpacity" REAL NOT NULL DEFAULT 0.7,
    "comfyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "comfyServerUrl" TEXT NOT NULL DEFAULT 'http://127.0.0.1:8188',
    "comfyWanVersion" TEXT NOT NULL DEFAULT 'wan22',
    "comfyWorkflowType" TEXT NOT NULL DEFAULT 'text-to-video',
    "comfyWorkflowPath" TEXT,
    "comfyNodeMapJson" TEXT,
    "comfyDefaultWidth" INTEGER NOT NULL DEFAULT 576,
    "comfyDefaultHeight" INTEGER NOT NULL DEFAULT 1024,
    "comfyDefaultFrames" INTEGER NOT NULL DEFAULT 81,
    "comfyDefaultFps" INTEGER NOT NULL DEFAULT 16,
    "comfyDefaultSteps" INTEGER NOT NULL DEFAULT 20,
    "comfyDefaultGuidance" REAL NOT NULL DEFAULT 5,
    "comfySeedMode" TEXT NOT NULL DEFAULT 'random',
    "comfyTimeoutMinutes" INTEGER NOT NULL DEFAULT 45,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("createdAt", "defaultVideoDuration", "defaultVoice", "exportsFolder", "id", "openaiApiKeySaved", "updatedAt", "watermarkEnabled", "watermarkOpacity", "watermarkPath", "watermarkPosition") SELECT "createdAt", "defaultVideoDuration", "defaultVoice", "exportsFolder", "id", "openaiApiKeySaved", "updatedAt", "watermarkEnabled", "watermarkOpacity", "watermarkPath", "watermarkPosition" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE TABLE "new_UGCProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "productUrl" TEXT,
    "productName" TEXT NOT NULL,
    "productCategory" TEXT NOT NULL,
    "productDescription" TEXT NOT NULL,
    "productBenefits" TEXT NOT NULL,
    "offerText" TEXT,
    "ctaText" TEXT,
    "targetAudience" TEXT,
    "creatorName" TEXT,
    "creatorVibe" TEXT,
    "creatorGender" TEXT,
    "creatorAgeRange" TEXT,
    "tone" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "videoProvider" TEXT NOT NULL DEFAULT 'veo3',
    "captionsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "musicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "brief" TEXT NOT NULL,
    "hook" TEXT,
    "script" TEXT,
    "storyboardJson" TEXT,
    "creatorProfileJson" TEXT,
    "productProfileJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "finalVideoPath" TEXT,
    "thumbnailPath" TEXT,
    "voiceoverPath" TEXT,
    "captionsPath" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_UGCProject" ("brief", "captionsEnabled", "captionsPath", "createdAt", "creatorAgeRange", "creatorGender", "creatorName", "creatorProfileJson", "creatorVibe", "ctaText", "duration", "errorMessage", "finalVideoPath", "hook", "id", "musicEnabled", "offerText", "platform", "productBenefits", "productCategory", "productDescription", "productName", "productProfileJson", "productUrl", "script", "status", "storyboardJson", "style", "targetAudience", "thumbnailPath", "title", "tone", "updatedAt", "voice", "voiceoverPath") SELECT "brief", "captionsEnabled", "captionsPath", "createdAt", "creatorAgeRange", "creatorGender", "creatorName", "creatorProfileJson", "creatorVibe", "ctaText", "duration", "errorMessage", "finalVideoPath", "hook", "id", "musicEnabled", "offerText", "platform", "productBenefits", "productCategory", "productDescription", "productName", "productProfileJson", "productUrl", "script", "status", "storyboardJson", "style", "targetAudience", "thumbnailPath", "title", "tone", "updatedAt", "voice", "voiceoverPath" FROM "UGCProject";
DROP TABLE "UGCProject";
ALTER TABLE "new_UGCProject" RENAME TO "UGCProject";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProviderJobLog_provider_ownerId_idx" ON "ProviderJobLog"("provider", "ownerId");
