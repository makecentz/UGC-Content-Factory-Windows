import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MANAGED_KEYS = ["OPENAI_API_KEY", "VEO_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "COMFY_CLOUD_API_KEY", "REELPILOT_EXPORTS_PATH"] as const;

type ManagedKey = (typeof MANAGED_KEYS)[number];

function configPath() {
  if (process.env.REELPILOT_CONFIG_PATH) return process.env.REELPILOT_CONFIG_PATH;
  if (process.env.REELPILOT_STORAGE_PATH) return path.join(path.dirname(process.env.REELPILOT_STORAGE_PATH), "reelpilot.env");
  return path.join(process.cwd(), "reelpilot.env");
}

function readConfigPaths() {
  const paths = [
    process.env.REELPILOT_CONFIG_PATH,
    process.env.REELPILOT_STORAGE_PATH ? path.join(path.dirname(process.env.REELPILOT_STORAGE_PATH), "reelpilot.env") : "",
    path.join(process.cwd(), "reelpilot.env"),
    path.join(process.cwd(), ".env.local")
  ].filter(Boolean) as string[];
  return [...new Set(paths)];
}

function parseEnv(text: string) {
  const values = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    values.set(match[1], value);
  }
  return values;
}

async function readConfigText() {
  try {
    return await readFile(configPath(), "utf8");
  } catch {
    return "";
  }
}

function readConfigValuesSync() {
  const values = new Map<string, string>();
  for (const filePath of readConfigPaths().reverse()) {
    if (!existsSync(filePath)) continue;
    try {
      for (const [key, value] of parseEnv(readFileSync(filePath, "utf8"))) values.set(key, value);
    } catch {
      // Ignore unreadable optional config files.
    }
  }
  return values;
}

export function localConfigValue(key: ManagedKey) {
  const value = process.env[key] || readConfigValuesSync().get(key) || "";
  if (key === "COMFY_CLOUD_API_KEY") return value.replace(/^Comfyui-/, "comfyui-");
  return value;
}

function serializeValue(value: string) {
  if (/[\s#"'\\]/.test(value)) return JSON.stringify(value);
  return value;
}

export async function saveLocalConfig(updates: Partial<Record<ManagedKey, string>>) {
  const target = configPath();
  const text = await readConfigText();
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/).filter((line, index, list) => index < list.length - 1 || line.trim() !== "");

  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match || !(match[1] in updates)) return line;
    const value = updates[match[1] as ManagedKey];
    if (!value) return line;
    seen.add(match[1]);
    return `${match[1]}=${serializeValue(value)}`;
  });

  for (const key of MANAGED_KEYS) {
    const value = updates[key];
    if (value && !seen.has(key)) nextLines.push(`${key}=${serializeValue(value)}`);
  }

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${nextLines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`);

  for (const [key, value] of Object.entries(updates)) {
    if (value) process.env[key] = value;
  }

  return target;
}

export async function loadLocalConfigIntoProcess() {
  for (const key of MANAGED_KEYS) {
    const value = localConfigValue(key);
    if (value && !process.env[key]) process.env[key] = value;
  }
}

export function apiKeyStatus() {
  return {
    openaiConfigured: Boolean(localConfigValue("OPENAI_API_KEY")),
    googleConfigured: Boolean(localConfigValue("VEO_API_KEY") || localConfigValue("GEMINI_API_KEY") || localConfigValue("GOOGLE_API_KEY")),
    comfyCloudConfigured: Boolean(localConfigValue("COMFY_CLOUD_API_KEY")),
    exportsFolder: localConfigValue("REELPILOT_EXPORTS_PATH")
  };
}
