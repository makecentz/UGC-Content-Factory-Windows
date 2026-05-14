import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import path from "node:path";

type LogLevel = "debug" | "info" | "warn" | "error";

export function logFilePath() {
  return process.env.REELPILOT_LOG_PATH || path.join(process.cwd(), "storage", "logs", "reelpilot.log");
}

export function logDirectory() {
  return path.dirname(logFilePath());
}

function redact(value: string) {
  return value
    .replace(/sk-proj-[A-Za-z0-9_-]{20,}/g, "<redacted>")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "<redacted>")
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, "<redacted>")
    .replace(/GOCSPX-[A-Za-z0-9_-]{10,}/g, "<redacted>")
    .replace(/(OPENAI_API_KEY|VEO_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|YOUTUBE_CLIENT_SECRET|ELEVENLABS_API_KEY)=([^\s]+)/g, "$1=<redacted>");
}

function serialize(value: unknown) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function writeLog(level: LogLevel, message: string, meta?: unknown) {
  const filePath = logFilePath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  const payload = meta === undefined ? "" : ` ${typeof meta === "string" ? meta : JSON.stringify(meta)}`;
  const line = redact(`[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${payload}\n`);
  await appendFile(filePath, line, "utf8");
}

export function logInfo(message: string, meta?: unknown) {
  return writeLog("info", message, meta).catch(() => undefined);
}

export function logWarn(message: string, meta?: unknown) {
  return writeLog("warn", message, meta).catch(() => undefined);
}

export function logError(message: string, error?: unknown, meta?: unknown) {
  return writeLog("error", message, { error: serialize(error), meta }).catch(() => undefined);
}

export function recentLogLines(maxLines = 200) {
  const filePath = logFilePath();
  if (!existsSync(filePath)) return [];
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  return lines.slice(Math.max(0, lines.length - maxLines)).map(redact);
}
