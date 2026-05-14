-- AlterTable
ALTER TABLE "Video" ADD COLUMN "finalRenderStatus" TEXT;
ALTER TABLE "Video" ADD COLUMN "renderLogsJson" TEXT;
ALTER TABLE "Video" ADD COLUMN "styleLockJson" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Scene" (
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
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" DATETIME,
    "editedPrompt" TEXT,
    "qualityReportJson" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scene_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Scene" ("camera", "clipPath", "createdAt", "duration", "endTime", "errorMessage", "id", "imagePath", "mood", "narration", "prompt", "provider", "providerJobId", "sceneNumber", "startTime", "status", "updatedAt", "videoId", "visualDescription") SELECT "camera", "clipPath", "createdAt", "duration", "endTime", "errorMessage", "id", "imagePath", "mood", "narration", "prompt", "provider", "providerJobId", "sceneNumber", "startTime", "status", "updatedAt", "videoId", "visualDescription" FROM "Scene";
DROP TABLE "Scene";
ALTER TABLE "new_Scene" RENAME TO "Scene";
CREATE INDEX "Scene_videoId_sceneNumber_idx" ON "Scene"("videoId", "sceneNumber");
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("createdAt", "defaultVideoDuration", "defaultVoice", "exportsFolder", "id", "openaiApiKeySaved", "updatedAt") SELECT "createdAt", "defaultVideoDuration", "defaultVoice", "exportsFolder", "id", "openaiApiKeySaved", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
