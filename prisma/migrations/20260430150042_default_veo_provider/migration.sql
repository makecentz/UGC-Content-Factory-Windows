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
    "videoProvider" TEXT NOT NULL DEFAULT 'veo',
    "useSceneConsistency" BOOLEAN NOT NULL DEFAULT true,
    "preferredSceneDuration" INTEGER NOT NULL DEFAULT 5,
    "transitionStyle" TEXT NOT NULL DEFAULT 'hard cut',
    "storyboardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Series" ("artStyle", "autoGenerate", "backgroundMusic", "captionStyle", "createdAt", "customNiche", "effects", "generationMode", "id", "language", "name", "niche", "platforms", "postingFrequency", "preferredSceneDuration", "scheduleTime", "storyboardEnabled", "transitionStyle", "updatedAt", "useSceneConsistency", "videoDuration", "videoProvider", "voice") SELECT "artStyle", "autoGenerate", "backgroundMusic", "captionStyle", "createdAt", "customNiche", "effects", "generationMode", "id", "language", "name", "niche", "platforms", "postingFrequency", "preferredSceneDuration", "scheduleTime", "storyboardEnabled", "transitionStyle", "updatedAt", "useSceneConsistency", "videoDuration", "videoProvider", "voice" FROM "Series";
DROP TABLE "Series";
ALTER TABLE "new_Series" RENAME TO "Series";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
