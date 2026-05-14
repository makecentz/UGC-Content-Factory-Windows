-- CreateTable
CREATE TABLE "Series" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Video" (
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
    "status" TEXT NOT NULL DEFAULT 'draft',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scheduledFor" DATETIME,
    CONSTRAINT "Video_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MusicTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filePath" TEXT NOT NULL,
    "mood" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "openaiApiKeySaved" BOOLEAN NOT NULL DEFAULT false,
    "defaultVoice" TEXT NOT NULL DEFAULT 'onyx',
    "defaultVideoDuration" TEXT NOT NULL DEFAULT '20-30 seconds',
    "exportsFolder" TEXT NOT NULL DEFAULT './storage/exports',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
