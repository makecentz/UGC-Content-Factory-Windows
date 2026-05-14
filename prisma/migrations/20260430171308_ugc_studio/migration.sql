-- CreateTable
CREATE TABLE "UGCProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productCategory" TEXT NOT NULL,
    "productDescription" TEXT NOT NULL,
    "productBenefits" TEXT NOT NULL,
    "offerText" TEXT,
    "ctaText" TEXT,
    "targetAudience" TEXT,
    "tone" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "UGCAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ugcProjectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalFileName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UGCAsset_ugcProjectId_fkey" FOREIGN KEY ("ugcProjectId") REFERENCES "UGCProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UGCScene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ugcProjectId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "narration" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "visualDescription" TEXT,
    "shotType" TEXT,
    "camera" TEXT,
    "mood" TEXT,
    "duration" REAL NOT NULL,
    "startTime" REAL NOT NULL,
    "endTime" REAL NOT NULL,
    "provider" TEXT,
    "providerJobId" TEXT,
    "clipPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "editedPrompt" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UGCScene_ugcProjectId_fkey" FOREIGN KEY ("ugcProjectId") REFERENCES "UGCProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UGCAsset_ugcProjectId_type_idx" ON "UGCAsset"("ugcProjectId", "type");

-- CreateIndex
CREATE INDEX "UGCScene_ugcProjectId_sceneNumber_idx" ON "UGCScene"("ugcProjectId", "sceneNumber");
