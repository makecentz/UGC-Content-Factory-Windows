-- CreateTable
CREATE TABLE "MotivationalShortProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'prompt',
    "youtubeUrl" TEXT,
    "sourceTranscript" TEXT,
    "prompt" TEXT,
    "pastedScript" TEXT,
    "topic" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'intense',
    "style" TEXT NOT NULL DEFAULT '8K photorealistic dramatic motivational cinematic video',
    "duration" TEXT NOT NULL DEFAULT '30 sec',
    "voice" TEXT NOT NULL DEFAULT 'Onyx - powerful male narrator',
    "videoProvider" TEXT NOT NULL DEFAULT 'veo3',
    "captionsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "captionsPath" TEXT,
    "captionStyle" TEXT NOT NULL DEFAULT 'Bold Stroke',
    "watermarkPath" TEXT,
    "watermarkPosition" TEXT NOT NULL DEFAULT 'bottom-right',
    "hook" TEXT,
    "script" TEXT,
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
CREATE TABLE "MotivationalShortScene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "motivationalShortProjectId" TEXT NOT NULL,
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
    CONSTRAINT "MotivationalShortScene_motivationalShortProjectId_fkey" FOREIGN KEY ("motivationalShortProjectId") REFERENCES "MotivationalShortProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MotivationalShortScene_motivationalShortProjectId_sceneNumber_idx" ON "MotivationalShortScene"("motivationalShortProjectId", "sceneNumber");
