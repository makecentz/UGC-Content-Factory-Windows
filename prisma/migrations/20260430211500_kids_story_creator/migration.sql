-- CreateTable
CREATE TABLE "KidsStoryProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'prompt',
    "youtubeUrl" TEXT,
    "sourceTranscript" TEXT,
    "prompt" TEXT,
    "ageRange" TEXT NOT NULL DEFAULT '4-8',
    "storyTheme" TEXT,
    "moral" TEXT,
    "artStyle" TEXT NOT NULL DEFAULT 'Bright storybook animation',
    "characterMode" TEXT NOT NULL DEFAULT 'ai',
    "duration" TEXT NOT NULL DEFAULT '3 min',
    "voiceProvider" TEXT NOT NULL DEFAULT 'openai',
    "voice" TEXT NOT NULL DEFAULT 'Nova - warm storyteller',
    "videoProvider" TEXT NOT NULL DEFAULT 'veo3',
    "script" TEXT,
    "storyboardJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "finalVideoPath" TEXT,
    "voiceoverPath" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KidsStoryAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kidsStoryProjectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalFileName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KidsStoryAsset_kidsStoryProjectId_fkey" FOREIGN KEY ("kidsStoryProjectId") REFERENCES "KidsStoryProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KidsStoryScene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kidsStoryProjectId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "narration" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "visualDescription" TEXT,
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
    "editedPrompt" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KidsStoryScene_kidsStoryProjectId_fkey" FOREIGN KEY ("kidsStoryProjectId") REFERENCES "KidsStoryProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KidsStoryAsset_kidsStoryProjectId_type_idx" ON "KidsStoryAsset"("kidsStoryProjectId", "type");

-- CreateIndex
CREATE INDEX "KidsStoryScene_kidsStoryProjectId_sceneNumber_idx" ON "KidsStoryScene"("kidsStoryProjectId", "sceneNumber");
