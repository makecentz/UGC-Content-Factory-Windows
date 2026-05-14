-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
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
    "imagePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scene_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "customNiche" TEXT,
    "language" TEXT NOT NULL DEFAULT 'English',
    "voice" TEXT NOT NULL,
    "artStyle" TEXT NOT NULL,
    "captionStyle" TEXT NOT NULL,
    "backgroundMusic" TEXT,
    "effects" TEXT NOT NULL DEFAULT '[]',
    "videoDuration" TEXT NOT NULL,
    "scheduleTime" TEXT,
    "postingFrequency" TEXT NOT NULL,
    "autoGenerate" BOOLEAN NOT NULL DEFAULT false,
    "platforms" TEXT NOT NULL DEFAULT '[]',
    "generationMode" TEXT NOT NULL DEFAULT 'story-video',
    "videoProvider" TEXT NOT NULL DEFAULT 'mock',
    "useSceneConsistency" BOOLEAN NOT NULL DEFAULT true,
    "preferredSceneDuration" INTEGER NOT NULL DEFAULT 5,
    "transitionStyle" TEXT NOT NULL DEFAULT 'hard cut',
    "storyboardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Series" ("artStyle", "autoGenerate", "backgroundMusic", "captionStyle", "createdAt", "customNiche", "effects", "id", "language", "name", "niche", "platforms", "postingFrequency", "scheduleTime", "updatedAt", "videoDuration", "voice") SELECT "artStyle", "autoGenerate", "backgroundMusic", "captionStyle", "createdAt", "customNiche", "effects", "id", "language", "name", "niche", "platforms", "postingFrequency", "scheduleTime", "updatedAt", "videoDuration", "voice" FROM "Series";
DROP TABLE "Series";
ALTER TABLE "new_Series" RENAME TO "Series";
CREATE TABLE "new_Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seriesId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "hook" TEXT,
    "description" TEXT,
    "hashtags" TEXT,
    "voiceoverPath" TEXT,
    "backgroundPath" TEXT,
    "musicPath" TEXT,
    "captionsPath" TEXT,
    "finalVideoPath" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'background',
    "storyboardJson" TEXT,
    "characterBibleJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scheduledFor" DATETIME,
    CONSTRAINT "Video_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Video" ("backgroundPath", "captionsPath", "createdAt", "description", "errorMessage", "finalVideoPath", "hashtags", "hook", "id", "musicPath", "scheduledFor", "script", "seriesId", "status", "title", "updatedAt", "voiceoverPath") SELECT "backgroundPath", "captionsPath", "createdAt", "description", "errorMessage", "finalVideoPath", "hashtags", "hook", "id", "musicPath", "scheduledFor", "script", "seriesId", "status", "title", "updatedAt", "voiceoverPath" FROM "Video";
DROP TABLE "Video";
ALTER TABLE "new_Video" RENAME TO "Video";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Scene_videoId_sceneNumber_idx" ON "Scene"("videoId", "sceneNumber");
