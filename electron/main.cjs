const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const isDev = !app.isPackaged;
const host = "127.0.0.1";
let logFilePath = "";
let consoleLoggingPatched = false;

function appRoot() {
  return isDev ? path.resolve(__dirname, "..") : app.getAppPath();
}

function userDataPath(...parts) {
  return path.join(app.getPath("userData"), ...parts);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readEnvFile(filePath) {
  try {
    const values = {};
    const text = fs.readFileSync(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      values[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
    return values;
  } catch {
    return {};
  }
}

function appendLog(message) {
  if (!logFilePath) return;
  const line = `[${new Date().toISOString()}] ${redactSecrets(message)}\n`;
  try {
    fs.appendFileSync(logFilePath, line);
  } catch {
    // Logging must never prevent startup.
  }
}

function redactSecrets(value) {
  return String(value)
    .replace(/sk-proj-[A-Za-z0-9_-]{20,}/g, "<redacted>")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "<redacted>")
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, "<redacted>")
    .replace(/GOCSPX-[A-Za-z0-9_-]{10,}/g, "<redacted>")
    .replace(/(OPENAI_API_KEY|VEO_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|YOUTUBE_CLIENT_SECRET|ELEVENLABS_API_KEY)=([^\s]+)/g, "$1=<redacted>");
}

function initializeLogging() {
  const logDir = userDataPath("logs");
  ensureDir(logDir);
  logFilePath = path.join(logDir, "reelpilot.log");
  patchConsoleLogging();
  appendLog("Starting UGC Content Factory Kids");
  appendLog(`appRoot=${appRoot()}`);
  appendLog(`userData=${app.getPath("userData")}`);
}

function patchConsoleLogging() {
  if (consoleLoggingPatched) return;
  consoleLoggingPatched = true;
  const formatArg = (arg) => {
    if (arg instanceof Error) return arg.stack || arg.message;
    if (typeof arg === "string") return arg;
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  };
  for (const method of ["error", "warn", "info"]) {
    const original = console[method].bind(console);
    console[method] = (...args) => {
      original(...args);
      appendLog(`${method.toUpperCase()} ${args.map(formatArg).join(" ")}`);
    };
  }
}

function bundledToolPath(toolName) {
  if (isDev) return "";
  const platformDir = process.platform === "win32" ? "win" : process.platform === "darwin" ? "mac" : "linux";
  const extension = process.platform === "win32" ? ".exe" : "";
  const candidate = path.join(process.resourcesPath, "vendor", platformDir, `${toolName}${extension}`);
  return fs.existsSync(candidate) ? candidate : "";
}

function packagedFilePath(...parts) {
  if (isDev) return "";
  const candidate = path.join(appRoot(), ...parts);
  return fs.existsSync(candidate) ? candidate : "";
}

function prismaQueryEnginePath() {
  if (process.platform === "win32") {
    return (
      packagedFilePath("node_modules", ".prisma", "client", "query_engine-windows.dll.node") ||
      packagedFilePath("node_modules", "@prisma", "engines", "query_engine-windows.dll.node")
    );
  }

  return (
    packagedFilePath("node_modules", ".prisma", "client", "libquery_engine-darwin-arm64.dylib.node") ||
    packagedFilePath("node_modules", "@prisma", "engines", "libquery_engine-darwin-arm64.dylib.node")
  );
}

function prismaSchemaEnginePath() {
  return packagedFilePath("node_modules", "@prisma", "engines", process.platform === "win32" ? "schema-engine-windows.exe" : "schema-engine-darwin-arm64");
}

function baseEnv() {
  const storagePath = userDataPath("storage");
  const cachePath = userDataPath("cache");
  const tempPath = userDataPath("temp");
  const configPath = userDataPath("reelpilot.env");
  const savedEnv = readEnvFile(configPath);
  ensureDir(storagePath);
  ensureDir(cachePath);
  ensureDir(tempPath);
  ensureDir(userDataPath("database"));

  return {
    ...process.env,
    ...savedEnv,
    NODE_ENV: isDev ? "development" : "production",
    DATABASE_URL: `file:${userDataPath("database", "reelpilot.db")}`,
    REELPILOT_CONFIG_PATH: configPath,
    REELPILOT_LOG_PATH: logFilePath,
    REELPILOT_APP_ROOT: appRoot(),
    REELPILOT_RESOURCES_PATH: isDev ? path.resolve(__dirname, "..") : process.resourcesPath,
    REELPILOT_STORAGE_PATH: storagePath,
    CACHE_DIR: cachePath,
    XDG_CACHE_HOME: cachePath,
    TEMP: tempPath,
    TMP: tempPath,
    RUST_LOG: "info",
    PRISMA_HIDE_UPDATE_MESSAGE: process.env.PRISMA_HIDE_UPDATE_MESSAGE || "1",
    PRISMA_SCHEMA_ENGINE_BINARY: prismaSchemaEnginePath() || process.env.PRISMA_SCHEMA_ENGINE_BINARY,
    PRISMA_QUERY_ENGINE_LIBRARY: prismaQueryEnginePath() || process.env.PRISMA_QUERY_ENGINE_LIBRARY,
    FFMPEG_PATH: bundledToolPath("ffmpeg") || process.env.FFMPEG_PATH || "ffmpeg",
    YT_DLP_PATH: bundledToolPath("yt-dlp") || process.env.YT_DLP_PATH || "yt-dlp"
  };
}

function runPrismaMigrations(env) {
  return new Promise((resolve, reject) => {
    const root = appRoot();
    const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
    const schema = path.join(root, "prisma", "schema.prisma");
    if (!fs.existsSync(prismaCli) || !fs.existsSync(schema)) {
      resolve();
      return;
    }

    const child = spawn(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schema], {
      cwd: root,
      env: { ...env, DEBUG: env.DEBUG || "prisma:fetch-engine:env", RUST_LOG: "info", ELECTRON_RUN_AS_NODE: "1" },
      stdio: isDev ? "inherit" : "pipe"
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      appendLog(`prisma migrate deploy exited ${code}\n${stdout}\n${stderr}`);
      if (code === 0) resolve();
      else {
        appendLog("Prisma migrate deploy failed; continuing to prisma db push for local desktop schema sync.");
        resolve();
      }
    });
  });
}

function runPrismaDbPush(env) {
  return new Promise((resolve, reject) => {
    const root = appRoot();
    const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
    const schema = path.join(root, "prisma", "schema.prisma");
    if (!fs.existsSync(prismaCli) || !fs.existsSync(schema)) {
      resolve();
      return;
    }

    const child = spawn(process.execPath, [prismaCli, "db", "push", "--skip-generate", "--schema", schema], {
      cwd: root,
      env: { ...env, DEBUG: env.DEBUG || "prisma:fetch-engine:env", RUST_LOG: "info", ELECTRON_RUN_AS_NODE: "1" },
      stdio: isDev ? "inherit" : "pipe"
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      appendLog(`prisma db push exited ${code}\n${stdout}\n${stderr}`);
      if (code === 0) resolve();
      else reject(new Error(stderr || stdout || `Prisma db push exited with code ${code}`));
    });
  });
}

function findPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, host, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function startNextServer(port, env) {
  const next = require("next");
  const root = appRoot();
  const nextApp = next({ dev: isDev, dir: root, hostname: host, port });
  const handler = nextApp.getRequestHandler();
  await nextApp.prepare();

  const server = http.createServer(async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      appendLog(`Next request failed ${req.method} ${req.url}: ${error?.stack || error}`);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Internal Server Error. See ReelPilot logs.");
      }
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  process.env = env;
  return server;
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve({ statusCode: res.statusCode || 0, body }));
      })
      .on("error", reject);
  });
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = http.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          try {
            resolve({ statusCode: res.statusCode || 0, body: responseBody ? JSON.parse(responseBody) : null });
          } catch {
            resolve({ statusCode: res.statusCode || 0, body: responseBody });
          }
        });
      }
    );
    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

async function verifyServer(port) {
  const response = await fetchText(`http://${host}:${port}/kids`);
  appendLog(`GET /kids startup check status=${response.statusCode} body=${response.body.slice(0, 1000)}`);
  return response;
}

function credentialsAreReady(env) {
  return Boolean(env.OPENAI_API_KEY);
}

function createWindow(port, startPath = "/kids") {
  const iconPath = path.join(appRoot(), "build", "icon.ico");
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    title: "UGC Content Factory Kids",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.loadURL(`http://${host}:${port}${startPath}`);
}

async function boot() {
  initializeLogging();
  const env = baseEnv();
  process.env = env;
  appendLog(`DATABASE_URL=${env.DATABASE_URL}`);
  appendLog(`REELPILOT_STORAGE_PATH=${env.REELPILOT_STORAGE_PATH}`);
  appendLog(`PRISMA_SCHEMA_ENGINE_BINARY=${env.PRISMA_SCHEMA_ENGINE_BINARY || ""}`);
  appendLog(`PRISMA_QUERY_ENGINE_LIBRARY=${env.PRISMA_QUERY_ENGINE_LIBRARY || ""}`);
  try {
    await runPrismaMigrations(env);
    await runPrismaDbPush(env);
    const port = await findPort();
    await startNextServer(port, env);
    await verifyServer(port);
    const comfyAutoStart = await postJson(`http://${host}:${port}/api/settings`, { action: "comfy-autostart" }).catch((error) => {
      appendLog(`ComfyUI auto-start check failed: ${error?.stack || error}`);
      return null;
    });
    if (comfyAutoStart) {
      appendLog(`ComfyUI auto-start response status=${comfyAutoStart.statusCode} body=${JSON.stringify(comfyAutoStart.body)}`);
      const message = typeof comfyAutoStart.body === "object" && comfyAutoStart.body ? comfyAutoStart.body.message : "";
      if (comfyAutoStart.body?.ok === false && String(message).includes("ComfyUI could not be started")) {
        dialog.showMessageBox({
          type: "warning",
          title: "ComfyUI",
          message: "ComfyUI could not be started. Please open it manually or check your configured path.",
          detail: String(message)
        });
      }
    }
    createWindow(port, credentialsAreReady(env) ? "/kids" : "/onboarding");
  } catch (error) {
    appendLog(`Startup failed: ${error?.stack || error}`);
    dialog.showErrorBox("UGC Content Factory Windows failed to start", `${error instanceof Error ? error.message : String(error)}\n\nLog file:\n${logFilePath}`);
    app.quit();
  }
}

process.on("uncaughtException", (error) => appendLog(`uncaughtException: ${error?.stack || error}`));
process.on("unhandledRejection", (error) => appendLog(`unhandledRejection: ${error?.stack || error}`));

app.whenReady().then(boot);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) boot();
});
