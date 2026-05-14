-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "comfyInstallFolder" TEXT;
ALTER TABLE "Settings" ADD COLUMN "comfyPythonPath" TEXT;
ALTER TABLE "Settings" ADD COLUMN "comfyLaunchCommand" TEXT NOT NULL DEFAULT 'python main.py --listen 127.0.0.1 --port 8188';
ALTER TABLE "Settings" ADD COLUMN "comfyAutoStart" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "comfyLocalDraftMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "comfyFallbackProvider" TEXT NOT NULL DEFAULT 'veo3';
