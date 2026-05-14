import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import OpenAI from "openai";
import { checkFfmpegInstalled, renderFinalStoryVideo, renderVerticalVideo } from "@/lib/ffmpeg";
import { logDirectory, logError, logFilePath, logInfo, recentLogLines } from "@/lib/logger";
import { apiKeyStatus, localConfigValue, saveLocalConfig } from "@/lib/local-config";
import { prisma } from "@/lib/prisma";
import { clearTempFiles, storagePath } from "@/lib/storage";
import { writeCaptionFiles } from "@/lib/captions";
import { selectFallbackBackground } from "@/lib/backgrounds";
import { mockProvider } from "@/lib/providers/mock-provider";
import { testComfyConnection } from "@/lib/providers/comfyui/comfyui-client";
import { getVideoProvider } from "@/lib/providers";
import { autoStartComfyIfEnabled, isComfyRunning, openComfyUI, restartComfyUI, startComfyUI, stopComfyUI } from "@/lib/local-process/comfyui-launcher";
import { checkWanSetup, installWan22FiveB, prepareWanFolders } from "@/lib/local-process/wan-setup";
import { loadWorkflowTemplate } from "@/lib/providers/comfyui/workflow-loader";
import { validateComfyWorkflowForLocalRender } from "@/lib/providers/comfyui/workflow-validator";

function normalizeSecretInput(value: unknown, envName: string) {
  let text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith(`${envName}=`)) text = text.slice(envName.length + 1).trim();
  text = text.replace(/^["']|["']$/g, "").trim();
  return text;
}

export async function GET() {
  const status = apiKeyStatus();
  let settings = await prisma.settings.findFirst();
  settings ??= await prisma.settings.create({
    data: {
      openaiApiKeySaved: status.openaiConfigured,
      comfyCloudApiKeySaved: false,
      exportsFolder: status.exportsFolder || storagePath("exports")
    }
  });
  return NextResponse.json({
    ...settings,
    openaiApiKeySaved: status.openaiConfigured,
    googleApiKeySaved: status.googleConfigured,
    comfyCloudApiKeySaved: false,
    exportsFolder: status.exportsFolder || settings.exportsFolder || storagePath("exports")
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "ffmpeg") {
    const check = await checkFfmpegInstalled();
    if (!check.installed) return NextResponse.json({ ok: false, message: check.message });

    try {
      const backgroundPath = await selectFallbackBackground("Cinematic Realism", "Test Render");
      const captions = await writeCaptionFiles(
        "test-visual-render",
        "ReelPilot visual render test. Background, captions, and video encoding are working.",
        5,
        "Bold Stroke"
      );
      const outputPath = storagePath("exports", "test-visual-render.mp4");

      await renderVerticalVideo({
        backgroundPath,
        captionsPath: captions.assPath,
        outputPath,
        durationSeconds: 5,
        effects: ["Zoom motion", "Vignette", "Film grain"]
      });

      return NextResponse.json({
        ok: true,
        message: `FFmpeg visual test rendered: ${outputPath}`,
        outputPath
      });
    } catch (error) {
      await logError("Settings FFmpeg health check failed", error);
      return NextResponse.json({
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "FFmpeg visual render failed. The Windows installer should include FFmpeg automatically. Reinstall from the latest installer or run the Windows media tools preparation script before packaging."
      });
    }
  }
  if (body.action === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: false, message: "OPENAI_API_KEY is missing from .env.local." });
    }
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      await openai.models.list();
      return NextResponse.json({ ok: true, message: "OpenAI connection works." });
    } catch (error) {
      await logError("Settings OpenAI health check failed", error);
      return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  }
  if (body.action === "google") {
    const key = localConfigValue("VEO_API_KEY") || localConfigValue("GEMINI_API_KEY") || localConfigValue("GOOGLE_API_KEY");
    if (!key) {
      return NextResponse.json({ ok: false, message: "Google/Veo API key is missing. Save it in Settings first." });
    }
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
      if (!response.ok) throw new Error(await response.text());
      return NextResponse.json({ ok: true, message: "Google/Veo API key is configured." });
    } catch (error) {
      await logError("Settings Google/Veo health check failed", error);
      return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  }
  if (body.action === "save-api-keys") {
    try {
      const openaiApiKey = normalizeSecretInput(body.openaiApiKey, "OPENAI_API_KEY");
      const googleApiKey = normalizeSecretInput(body.googleApiKey, "GOOGLE_API_KEY");
      const exportsFolder = String(body.exportsFolder || "").trim() || storagePath("exports");
      const updates: Record<string, string> = { REELPILOT_EXPORTS_PATH: exportsFolder };
      if (openaiApiKey) updates.OPENAI_API_KEY = openaiApiKey;
      if (googleApiKey) {
        updates.VEO_API_KEY = googleApiKey;
        updates.GEMINI_API_KEY = googleApiKey;
        updates.GOOGLE_API_KEY = googleApiKey;
      }
      const configPath = await saveLocalConfig(updates);
      const current = await prisma.settings.findFirst();
      const statusAfterSave = apiKeyStatus();
      const data = {
        openaiApiKeySaved: statusAfterSave.openaiConfigured,
        comfyCloudApiKeySaved: false,
        exportsFolder
      };
      if (current) await prisma.settings.update({ where: { id: current.id }, data });
      else await prisma.settings.create({ data });
      return NextResponse.json({
        ok: true,
        message: `Settings saved. New credentials are active now and will be reused after restart.`,
        configPath,
        openaiConfigured: statusAfterSave.openaiConfigured,
        comfyCloudConfigured: false,
        googleConfigured: statusAfterSave.googleConfigured,
        exportsFolder
      });
    } catch (error) {
      await logError("Saving API keys and export folder failed", error);
      return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  }
  if (body.action === "clear-temp") {
    await clearTempFiles();
    await logInfo("Temporary files cleared from Settings");
    return NextResponse.json({ ok: true, message: "Temporary files cleared." });
  }
  if (body.action === "open-logs") {
    const dir = logDirectory();
    await logInfo("Opened logs folder from Settings", { dir });
    if (!existsSync(dir)) return NextResponse.json({ ok: false, message: `Log folder does not exist yet: ${dir}` });
    execFile(process.platform === "win32" ? "explorer.exe" : "open", [dir]);
    return NextResponse.json({ ok: true, message: `Opened logs folder: ${dir}`, logPath: logFilePath() });
  }
  if (body.action === "diagnostics") {
    const status = apiKeyStatus();
    const settings = await prisma.settings.findFirst();
    return NextResponse.json({
      ok: true,
      message: `Diagnostics ready. Log file: ${logFilePath()}`,
      diagnostics: {
        logPath: logFilePath(),
        storagePath: process.env.REELPILOT_STORAGE_PATH || null,
        exportsFolder: settings?.exportsFolder || status.exportsFolder || storagePath("exports"),
        databaseUrl: process.env.DATABASE_URL || null,
        ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
        ytDlpPath: process.env.YT_DLP_PATH || "yt-dlp",
        openaiConfigured: status.openaiConfigured,
        googleConfigured: status.googleConfigured,
        comfyCloudConfigured: false,
        nodeEnv: process.env.NODE_ENV || null,
        packaged: Boolean(process.env.REELPILOT_LOG_PATH),
        recentLogLines: recentLogLines(60)
      }
    });
  }
  if (body.action === "save-comfy") {
    try {
      if (body.comfyNodeMapJson) JSON.parse(String(body.comfyNodeMapJson));
      const current = await prisma.settings.findFirst();
      const data = {
        comfyEnabled: Boolean(body.comfyEnabled),
        comfyServerUrl: String(body.comfyServerUrl || "http://127.0.0.1:8188"),
        comfyWanVersion: String(body.comfyWanVersion || "wan22"),
        comfyWorkflowType: String(body.comfyWorkflowType || "text-to-video"),
        comfyWorkflowPath: String(body.comfyWorkflowPath || "") || null,
        comfyCloudWorkflowPath: null,
        comfyCloudFallbackProvider: "retry",
        comfyNodeMapJson: String(body.comfyNodeMapJson || "") || null,
        comfyInstallFolder: String(body.comfyInstallFolder || "") || null,
        comfyPythonPath: String(body.comfyPythonPath || "") || null,
        comfyLaunchCommand: String(body.comfyLaunchCommand || "python main.py --listen 127.0.0.1 --port 8188"),
        comfyAutoStart: Boolean(body.comfyAutoStart),
        comfyLocalDraftMode: Boolean(body.comfyLocalDraftMode),
        comfyFallbackProvider: String(body.comfyFallbackProvider || "veo3"),
        comfyDefaultWidth: Number(body.comfyDefaultWidth || 576),
        comfyDefaultHeight: Number(body.comfyDefaultHeight || 1024),
        comfyDefaultFrames: Number(body.comfyDefaultFrames || 81),
        comfyDefaultFps: Number(body.comfyDefaultFps || 16),
        comfyDefaultSteps: Number(body.comfyDefaultSteps || 20),
        comfyDefaultGuidance: Number(body.comfyDefaultGuidance || 5),
        comfySeedMode: String(body.comfySeedMode || "random"),
        comfyTimeoutMinutes: Number(body.comfyTimeoutMinutes || 45)
      };
      if (current) await prisma.settings.update({ where: { id: current.id }, data });
      else await prisma.settings.create({ data: { ...data, openaiApiKeySaved: apiKeyStatus().openaiConfigured, comfyCloudApiKeySaved: false, exportsFolder: apiKeyStatus().exportsFolder || storagePath("exports") } });
      return NextResponse.json({ ok: true, message: "ComfyUI settings saved." });
    } catch (error) {
      await logError("Saving ComfyUI settings failed", error);
      return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Node mapping JSON is invalid." });
    }
  }
  if (body.action === "comfy-test") {
    const result = await testComfyConnection();
    return NextResponse.json(result);
  }
  if (body.action === "comfy-scan") {
    try {
      const settings = await prisma.settings.findFirst();
      const { workflow, filePath } = await loadWorkflowTemplate({
        wanVersion: (settings?.comfyWanVersion || "wan22") as "wan21" | "wan22",
        workflowType: (settings?.comfyWorkflowType || "text-to-video") as "text-to-video" | "image-to-video" | "custom-workflow",
        customPath: settings?.comfyWorkflowPath,
        requireLocalWorkflow: true
      });
      const result = validateComfyWorkflowForLocalRender(workflow);
      return NextResponse.json({ ok: result.ok, message: result.message, forbiddenNodes: result.forbiddenNodes, filePath });
    } catch (error) {
      await logError("ComfyUI workflow scan failed", error);
      return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error), forbiddenNodes: [] });
    }
  }
  if (body.action === "comfy-status") return NextResponse.json(await isComfyRunning());
  if (body.action === "comfy-start") return NextResponse.json(await startComfyUI(true));
  if (body.action === "comfy-stop") return NextResponse.json(await stopComfyUI());
  if (body.action === "comfy-restart") return NextResponse.json(await restartComfyUI());
  if (body.action === "comfy-open") return NextResponse.json(await openComfyUI());
  if (body.action === "comfy-autostart") return NextResponse.json(await autoStartComfyIfEnabled());
  if (body.action === "wan-setup-check") return NextResponse.json(await checkWanSetup());
  if (body.action === "wan-setup-prepare") return NextResponse.json(await prepareWanFolders());
  if (body.action === "wan-setup-install") {
    try {
      return NextResponse.json(await installWan22FiveB(String(body.huggingFaceToken || "").trim() || undefined));
    } catch (error) {
      return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  }
  if (body.action === "local-wan") {
    try {
      const settings = await prisma.settings.findFirst();
      const provider = getVideoProvider(settings?.comfyWanVersion === "wan21" ? "local-comfyui-wan21" : "local-comfyui-wan22");
      const job = await provider.generateSceneClip({
        prompt: "Vertical 9:16 cinematic shot of a glowing futuristic city street at night, slow camera push in, no text",
        duration: 3,
        aspectRatio: "9:16",
        style: "Cinematic Realism",
        sceneId: "test-local-wan-render",
        sceneNumber: 1,
        narration: "Local Wan render test.",
        mode: "text-to-video",
        projectType: "test",
        localVideoSettings: { width: 384, height: 672, frames: 33, fps: 12, steps: 12, guidance: 4 }
      });
      const status = await provider.getSceneClipStatus(job.jobId);
      if (status.status !== "ready") throw new Error(status.errorMessage || "Local Wan test did not finish.");
      const outputPath = storagePath("exports", "test-local-wan-render.mp4");
      await provider.downloadSceneClip(job.jobId, outputPath);
      return NextResponse.json({ ok: true, message: `Local Wan test rendered: ${outputPath}`, outputPath });
    } catch (error) {
      await logError("Settings Local Wan health check failed", error);
      return NextResponse.json({
        ok: false,
        message: error instanceof Error ? error.message : "ComfyUI is not running. Start ComfyUI and try again."
      });
    }
  }
  if (body.action === "story-video") {
    try {
      const script = "A young inventor discovers a glowing machine. The room shakes as the invention wakes up. By sunrise, the city sees the impossible become real.";
      const captions = await writeCaptionFiles("test-story-video", script, 15, "Bold Stroke");
      const scenes = [
        {
          sceneNumber: 1,
          narration: "A young inventor discovers a glowing machine.",
          prompt: "Vertical 9:16 modern cartoon story scene. A young inventor in a warm workshop finds a glowing machine on a wooden table, gears and blueprints around them, slow push-in, no text.",
          duration: 5
        },
        {
          sceneNumber: 2,
          narration: "The room shakes as the invention wakes up.",
          prompt: "Vertical 9:16 modern cartoon story scene. The glowing machine hums to life, papers swirl, dramatic light spills across the workshop, expressive motion, no text.",
          duration: 5
        },
        {
          sceneNumber: 3,
          narration: "By sunrise, the city sees the impossible become real.",
          prompt: "Vertical 9:16 modern cartoon story scene. Sunrise over a city as people look up in wonder at a beautiful impossible invention flying above rooftops, cinematic framing, no text.",
          duration: 5
        }
      ];
      const scenePaths: string[] = [];
      for (const scene of scenes) {
        const job = await mockProvider.generateSceneClip({
          prompt: scene.prompt,
          duration: scene.duration,
          aspectRatio: "9:16",
          style: "Modern Cartoon",
          sceneId: `test-story-video-${scene.sceneNumber}`,
          sceneNumber: scene.sceneNumber,
          narration: scene.narration
        });
        const status = await mockProvider.getSceneClipStatus(job.jobId);
        scenePaths.push(await mockProvider.downloadSceneClip(job.jobId, status.downloadUrl || ""));
      }
      const outputPath = storagePath("exports", "test-story-video.mp4");
      await renderFinalStoryVideo({
        scenePaths,
        captionsPath: captions.assPath,
        outputPath,
        duration: 15,
        transitionStyle: "hard cut"
      });
      return NextResponse.json({ ok: true, message: `Story Video Mode test rendered: ${outputPath}`, outputPath });
    } catch (error) {
      await logError("Settings Story Video Mode health check failed", error);
      return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return NextResponse.json({ error: "Unknown settings action." }, { status: 400 });
}
