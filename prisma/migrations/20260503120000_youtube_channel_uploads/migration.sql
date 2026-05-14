-- AlterTable
ALTER TABLE "KidsStoryProject" ADD COLUMN "youtubeChannelId" TEXT;
ALTER TABLE "KidsStoryProject" ADD COLUMN "youtubeVideoId" TEXT;
ALTER TABLE "KidsStoryProject" ADD COLUMN "youtubeVideoUrl" TEXT;
ALTER TABLE "KidsStoryProject" ADD COLUMN "youtubeUploadStatus" TEXT;
ALTER TABLE "KidsStoryProject" ADD COLUMN "youtubeUploadedAt" DATETIME;

-- CreateTable
CREATE TABLE "YouTubeChannelConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "channelTitle" TEXT NOT NULL,
    "channelThumbnailUrl" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" DATETIME,
    "scope" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeChannelConnection_channelId_key" ON "YouTubeChannelConnection"("channelId");

-- CreateIndex
CREATE INDEX "YouTubeChannelConnection_selected_idx" ON "YouTubeChannelConnection"("selected");
