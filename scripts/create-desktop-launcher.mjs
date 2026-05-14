#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import path from "node:path";

const silent = process.argv.includes("--silent");
const appDir = process.cwd();
const desktopDir = path.join(homedir(), "Desktop");

function log(message) {
  if (!silent) {
    console.log(message);
  }
}

function warn(message) {
  if (!silent) {
    console.warn(message);
  }
}

if (process.env.CI || process.env.REELPILOT_SKIP_DESKTOP_LAUNCHER === "1") {
  log("Skipping ReelPilot desktop launcher creation.");
  process.exit(0);
}

if (!existsSync(desktopDir)) {
  warn(`Desktop folder was not found at ${desktopDir}. Skipping launcher creation.`);
  process.exit(0);
}

if (platform() === "win32") {
  const launcherPath = path.join(desktopDir, "Start ReelPilot Local.cmd");
  const content = `@echo off
cd /d "${appDir}"
echo Starting ReelPilot local server...
if not exist node_modules (
  echo Installing dependencies first. This can take a few minutes...
  npm install
)
start "" "http://localhost:3000"
npm run dev
pause
`;

  writeFileSync(launcherPath, content, "utf8");
  log(`Created ReelPilot desktop launcher: ${launcherPath}`);
  process.exit(0);
}

const launcherPath = path.join(desktopDir, "Start ReelPilot Local.command");
const content = `#!/bin/zsh

set -e

APP_DIR="${appDir.replaceAll('"', '\\"')}"

cd "$APP_DIR"

echo "Starting ReelPilot local server..."
echo "Project folder: $APP_DIR"
echo ""

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. Please install Node.js first, then run this again."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies first. This can take a few minutes..."
  npm install
fi

echo "Opening ReelPilot in your browser..."
(sleep 5 && open "http://localhost:3000") >/dev/null 2>&1 &

npm run dev
`;

writeFileSync(launcherPath, content, "utf8");
chmodSync(launcherPath, 0o755);

try {
  mkdirSync(path.join(appDir, ".reelpilot"), { recursive: true });
  writeFileSync(path.join(appDir, ".reelpilot", "desktop-launcher-path.txt"), `${launcherPath}\n`, "utf8");
} catch {
  // Non-critical convenience breadcrumb only.
}

log(`Created ReelPilot desktop launcher: ${launcherPath}`);
