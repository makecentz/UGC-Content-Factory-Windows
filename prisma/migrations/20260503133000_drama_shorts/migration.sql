-- CreateTable
CREATE TABLE "DramaShortProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT '8K photorealistic suspense drama',
    "duration" TEXT NOT NULL DEFAULT '30 sec',
    "voice" TEXT NOT NULL DEFAULT 'Onyx - tense narrator',
    "videoProvider" TEXT NOT NULL DEFAULT 'veo3',
    "script" TEXT,
    "hook" TEXT,
    "caption" TEXT,
    "storyboardJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "finalVideoPath" TEXT,
    "voiceoverPath" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DramaShortScene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dramaShortProjectId" TEXT NOT NULL,
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
    CONSTRAINT "DramaShortScene_dramaShortProjectId_fkey" FOREIGN KEY ("dramaShortProjectId") REFERENCES "DramaShortProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DramaShortScene_dramaShortProjectId_sceneNumber_idx" ON "DramaShortScene"("dramaShortProjectId", "sceneNumber");
