# UGC Content Factory Kids

UGC Content Factory Kids is a local-first Windows desktop app for creating kids story videos. The app focuses on one workflow:

1. Create a kids story project.
2. Add an optional YouTube source, prompt, or character references.
3. Upload optional intro and outro videos.
4. Generate the image story video.
5. Render the final MP4.
6. Open completed videos from the **Completed Videos** section.

The Windows installer bundles the desktop runtime and media tools so end users do not need Node.js, FFmpeg, Homebrew, or terminal setup.

## Current Scope

- Kids Stories only
- OpenAI story/script/image/voice generation
- Local project storage with SQLite
- Bundled FFmpeg, FFprobe, and yt-dlp for packaged Windows builds
- Local ComfyUI + Wan setup tools for users who want local video rendering
- Manual upload details, title, thumbnail, description, and tags
- Completed rendered kids videos listed in **Completed Videos**

Other video modes are hidden from the user-facing app so the experience stays focused on kids stories.

## Development

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
npm run dist:win
```

The one-click Windows installer is written to:

```text
dist-electron/UGC-Content-Factory-Windows-Setup-1.0.0-beta.0-x64.exe
```

## Windows Media Tools

Before packaging, `npm run dist:win` runs:

```powershell
npm run electron:prepare-win-tools
```

That prepares:

```text
vendor/win/ffmpeg.exe
vendor/win/ffprobe.exe
vendor/win/yt-dlp.exe
```

Those files are bundled into the installer through Electron Builder `extraResources`.
