# UGC Content Factory Windows

Current beta build: **1.0.0-beta.0**

UGC Content Factory Windows is a local-first Windows desktop video studio for creating UGC ads, motivational shorts, drama shorts, kids stories, and faceless short-form videos. The packaged app starts its own local server, opens the desktop interface, stores projects in SQLite, saves files locally, and uses bundled tools such as FFmpeg and yt-dlp.

The normal user experience is:

1. Install ReelPilot.
2. Open the app.
3. Add API keys in the welcome screen or Settings.
4. Create videos from prompts, YouTube links, or uploaded assets.
5. Export or upload to YouTube.

## Quick Install For Normal Users

Use the desktop installer when possible. It is the easiest path because ReelPilot does the local setup work for you.

Download the latest installer here:

```text
https://github.com/makecentz/ReelPilot/releases/latest
```

### macOS

Download and run the latest macOS `.dmg` or `.pkg` installer from the release page.

After install:

1. Open **ReelPilot** from Applications.
2. Add your API keys on the welcome screen.
3. Choose a default export folder in Settings.
4. Start creating videos.

The desktop app automatically:

- starts the local ReelPilot server on a private localhost port
- opens the app window
- creates and updates the local SQLite database
- stores project files under the app data folder
- uses bundled FFmpeg, FFprobe, and yt-dlp when packaged
- can auto-start a configured local ComfyUI install if enabled

### Windows

Use the Windows installer from the project release when available. The Windows app follows the same flow: install, open ReelPilot, add API keys, and create videos.

## API Keys

Open **Settings** to add or replace keys. Each key field includes a direct link to the provider page.

Required for most workflows:

- **OpenAI API key:** scripts, storyboards, images, and voiceover

Optional by provider:

- **Comfy Cloud API key:** recommended video render provider for users who want easier setup
- **Google / Veo API key:** Veo 3 video generation
- **YouTube OAuth client:** posting completed kids videos to YouTube
- **ElevenLabs API key:** optional voice provider

ReelPilot stores keys locally on the device. Do not commit `.env.local`, `reelpilot.env`, or app data folders to GitHub.

## What Works Locally

- Kids stories in `16:9` and `9:16`
- Kids storyboard images, voiceover, final render, thumbnails, metadata, and YouTube upload
- Motivational shorts with optional captions and watermark
- Drama shorts
- UGC Studio
- Comfy Cloud provider
- Optional Local ComfyUI Wan provider for advanced users
- FFmpeg final rendering
- Local logs and diagnostics from Settings

## Developer Setup

Use this only if you want to run or modify the source code.

### Install Dependencies

```bash
npm install
```

Create `.env.local` from the example:

```bash
cp .env.example .env.local
```

At minimum, set:

```bash
OPENAI_API_KEY=sk-your-key
DATABASE_URL="file:./dev.db"
REELPILOT_STORAGE_PATH=./storage
FFMPEG_PATH=ffmpeg
```

### Media Tools

Windows installer builds bundle FFmpeg, FFprobe, and yt-dlp from `vendor/win`, so end users do not need Homebrew, Node.js, or separate media tool installs.

For local Windows development, prepare the bundled tools:

```bash
npm run prepare:media-tools
```

For local macOS development, install FFmpeg/yt-dlp on PATH or run the mac packaging prep script before building installers.

Check it:

```bash
npm run check:ffmpeg
```

### Database

Run the initial SQLite migration:

```bash
npx prisma migrate dev --name init
```

Optional database browser:

```bash
npm run prisma:studio
```

### Start ReelPilot In Development

Your terminal must be inside the ReelPilot project folder before starting localhost:

```bash
cd /Users/makecentz/Documents/Youtubecartoonshorts/ReelPilot
```

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### Desktop Localhost Launcher

For non-packaged local development, ReelPilot can create a clickable launcher on your Desktop.

Create or refresh it manually:

```bash
npm run setup:desktop-icon
```

On macOS this creates:

```text
~/Desktop/Start ReelPilot Local.command
```

On Windows this creates:

```text
%USERPROFILE%\Desktop\Start ReelPilot Local.cmd
```

Double-clicking the launcher opens the correct project folder, starts `npm run dev`, and opens `http://localhost:3000`. Keep the terminal window open while using the local app. Closing it stops localhost.

The launcher is also created automatically after `npm install` when a Desktop folder is available. To skip this behavior, set:

```bash
REELPILOT_SKIP_DESKTOP_LAUNCHER=1 npm install
```

### Build Desktop Installers

macOS:

```bash
npm run dist:mac
```

Output goes to:

```text
dist-electron/
```

Windows:

```bash
npm run dist:win
```

Packaged installers are intentionally ignored by git. Upload finished `.dmg`, `.pkg`, `.zip`, or `.exe` files to a GitHub Release so non-technical users can download them directly.

### Signing And Notarization

For public macOS distribution, build artifacts should be Developer ID signed and Apple notarized. A signed but unnotarized installer may still show a Gatekeeper warning.

## Create Your First Series

1. Go to **Create Series**.
2. Choose a niche, language, voice, music, art style, caption style, and effects.
3. Mark intended platforms for local planning.
4. Add series details and click **Create Series**.

## Generate Your First Video

From the Dashboard, click **Generate Test Video**, or open a series card and click **Generate Video**.

ReelPilot will:

1. Create a video row with `generating` status.
2. Generate a title, hook, script, description, and hashtags with OpenAI.
3. Generate an MP3 voiceover with OpenAI text-to-speech.
4. Create ASS and SRT captions.
5. Render a 1080x1920 H.264/AAC MP4 with FFmpeg.
6. Save the final export and mark the video `ready`.

If OpenAI, FFmpeg, music, background, or rendering fails, the video is marked `failed` with a friendly error message.

## Export Location

Finished MP4 files are saved in:

```text
storage/exports
```

Other local assets live in:

```text
storage/voiceovers
storage/music
storage/backgrounds
storage/captions
storage/scenes
storage/storyboards
storage/providers
storage/comfyui/workflows
storage/comfyui/inputs
storage/comfyui/outputs
storage/scenes/local-wan
storage/ugc/products
storage/ugc/creators
storage/ugc/scenes
storage/ugc/voiceovers
storage/ugc/captions
storage/ugc/exports
storage/temp
```

## Story Video Mode

Story Video Mode turns one script into a scene-based reel:

1. Generate script and voiceover.
2. Build a storyboard with 4-6 second scenes.
3. Create a character bible for recurring people, locations, and tone.
4. Build one visual prompt per scene using the selected art style.
5. Generate or mock-render scene clips.
6. Stitch clips into a 1080x1920 reel.
7. Add voiceover, optional music, and captions.

New series default to Story Video Mode with Comfy Cloud as the easiest provider. Veo 3, Local ComfyUI, and Mock remain available as provider choices.

## Veo 3 And Local Test Renderer

The `veo` provider is wired through Google GenAI and uses `VEO_API_KEY`. Use it when you want Google/Veo rendering instead of Comfy Cloud.

The local test renderer is fully local. It creates short pseudo-scene videos with themed backgrounds, scene labels, prompt/narration overlays, and subtle motion for **Test Story Video Mode**.

Runway is scaffolded in `lib/providers/`, but its API calls are TODOs. Add keys to `.env.local` when you implement or use it:

```bash
DEFAULT_VIDEO_PROVIDER=veo
RUNWAY_API_KEY=
VEO_API_KEY=
VEO_MODEL=veo-3.1-generate-preview
```

## How Scene Generation Works

- Storyboard logic lives in `lib/storyboard.ts`.
- Character consistency lives in `lib/character-bible.ts`.
- Style locks live in `lib/style-locks.ts`.
- Prompt cleanup lives in `lib/prompt-sanitizer.ts`.
- Scene quality checks live in `lib/scene-quality.ts`.
- Style prompt presets live in `lib/style-presets.ts`.
- Scene job orchestration lives in `lib/scene-pipeline.ts`.
- Provider adapters live in `lib/providers/`.
- Final stitching and audio/caption assembly lives in `lib/ffmpeg.ts`.

Each generated story video gets scene rows in SQLite and local clips in `storage/scenes`. Storyboard JSON is saved in `storage/storyboards`.

## Reviewing Scenes

Open a generated story video and use the **Storyboard Review** section.

Each scene card shows:

- scene number and timing
- narration
- Veo prompt
- generated clip preview
- provider job id
- retry count
- quality check summary
- status and approval state

Use **Edit prompt** to save a manual prompt change. Use **Regenerate With Edited Prompt** to regenerate only that scene. Use **Approve Scene** when the clip is good.

## Rendering Final Video

Click **Render Final Video** from the video detail page after reviewing scenes. ReelPilot stitches approved or ready scenes, adds voiceover, optional music, captions, and optional watermark, then exports the final MP4.

If not all scenes are ready or approved, ReelPilot warns before rendering with the usable scenes.

## Character Consistency

ReelPilot creates a character bible from the script and stores it with the video. The bible includes recurring character role, age, appearance, clothing, mood, and consistency rules. That character bible is injected into every scene prompt before sending it to the video provider.

## Style Locks

Each art style maps to a locked preset with vertical 9:16 framing, lighting, camera movement, motion style, color palette, and negative prompt rules. Style locks tell providers not to add captions, subtitles, logos, watermarks, or text inside clips because ReelPilot adds captions later.

## Watermarking

Open **Settings** to upload a PNG watermark. You can enable or disable it, choose bottom-right, bottom-center, or top-right placement, and set opacity. Watermarks are applied during final story renders.

## UGC Studio

UGC Studio is a separate workflow for product-style creator ads. Open **UGC Studio** from the sidebar, then click **Create New UGC Ad**.

Required flow:

1. Upload a product image.
2. Upload a creator/person reference image.
3. Enter product details, benefits, offer, CTA, audience, and creative brief.
4. Choose duration, platform, UGC style, voice, captions, and music settings.
5. Create the project.
6. Click **Generate UGC Video** on the project detail page.
7. Review scenes, edit prompts, regenerate weak scenes, approve clips, then click **Render Final Video**.

UGC exports are saved in:

```text
storage/ugc/exports
```

## UGC Upload Guidance

Product images work best when the packaging is clear, well-lit, and not heavily cropped. Creator images work best when the person is visible, front-facing, and naturally lit.

ReelPilot uses creator images as private creative references for appearance consistency. It does not assume the person is a public figure. Exact face, hand, and packaging consistency may vary by video provider.

## How UGC Generation Works

- Product reference summaries live in `lib/ugc/product-profile.ts`.
- Creator reference summaries live in `lib/ugc/creator-profile.ts`.
- UGC script generation lives in `lib/ugc/script-generator.ts`.
- UGC storyboard planning lives in `lib/ugc/storyboard.ts`.
- UGC scene prompts live in `lib/ugc/prompt-builder.ts`.
- UGC orchestration lives in `lib/ugc/pipeline.ts`.

The UGC pipeline reuses the same Veo provider, OpenAI voiceover, caption files, scene quality checks, and FFmpeg final renderer as Story Video Mode.

## Local ComfyUI + Wan Setup

ReelPilot can generate scene clips locally through a running ComfyUI server using Wan 2.1 or Wan 2.2 workflows. This can avoid Veo credits, but speed and quality depend on your hardware and workflow.

## Comfy Cloud Rendering

Comfy Cloud is the recommended default for users who want a smoother install. The user saves a `COMFY_CLOUD_API_KEY` in **Settings**, chooses **Comfy Cloud** as the video provider, and ReelPilot submits the API workflow to Comfy Cloud instead of a local `127.0.0.1:8188` server.

Provider order for new drama, motivational, UGC, and story-video projects:

1. **Comfy Cloud**: easiest setup, uses the user's Comfy Cloud account/credits.
2. **Veo 3**: optional fallback/provider choice when the user selects it.
3. **Local ComfyUI**: advanced local mode for users who install models and workflows.
4. **Mock**: testing only.

Cloud workflows may use Wan API nodes such as `WanTextToVideoApi`. Those nodes are still blocked in **Local ComfyUI** mode because they require login/API access and are not true local rendering.

Basic setup:

1. Install ComfyUI.
2. Start ComfyUI locally.
3. Confirm `http://127.0.0.1:8188` opens in your browser.
4. Install or add Wan 2.1 / Wan 2.2 models and any required ComfyUI custom nodes.
5. Open your Wan workflow in ComfyUI and test it manually first.
6. Export the workflow in API format.
7. Place the exported JSON in `workflows/`, or point ReelPilot Settings to its absolute path.
8. Update the node mapping JSON in Settings so prompt, negative prompt, width, height, frames, fps, seed, steps, and guidance map to your workflow node IDs.
9. Open ReelPilot **Settings**.
10. Save the ComfyUI settings.
11. Click **Test Connection**.
12. Click **Test Local Wan Render**.
13. Select **Local ComfyUI Wan 2.1** or **Local ComfyUI Wan 2.2** in Series or UGC Studio.

Important: ComfyUI API workflows are not always the same as visual workflow files. Use ComfyUI's API/export format for `/prompt`. The placeholder files in `workflows/` are only examples and must be replaced with real Wan workflow JSON before rendering.

### Correct Local Wan Workflows

Do not use workflows that contain `WanTextToVideoApi`, `WanImageToVideoApi`, `WanVideoApi`, `ComfyCloud`, or other API/cloud/login nodes for local rendering. Those nodes require account login and may use cloud credits. ReelPilot blocks them before submission so a "local" render does not accidentally call a paid or authenticated service.

Local Wan workflows must load model files from your local ComfyUI install. Good local workflows usually include nodes such as:

- Load Diffusion Model
- Load CLIP
- Load VAE
- WanImageToVideo
- WanFirstLastFrameToVideo
- WanVideoWrapper / Kijai Wan nodes
- Video Combine

Recommended Wan 2.1 local model folders:

```text
ComfyUI/models/diffusion_models/
ComfyUI/models/text_encoders/
ComfyUI/models/vae/
```

Optional image-reference models may also use:

```text
ComfyUI/models/clip_vision/
```

Open **Settings** and click **Scan Workflow** after selecting a workflow. ReelPilot will show either `Workflow looks local-ready` or the exact blocked nodes with node id, class/type, and reason.

### Optional Local ComfyUI Launcher

ReelPilot does not bundle ComfyUI yet. If you already installed ComfyUI separately, Settings can start that local install for you.

Configure:

- ComfyUI install folder
- Python executable path
- Launch command
- Auto-start ComfyUI when ReelPilot opens

Example launch command:

```text
python main.py --listen 127.0.0.1 --port 8188
```

Use **Start ComfyUI**, **Stop ComfyUI**, **Restart ComfyUI**, and **Open ComfyUI in browser** from Settings. If auto-start is enabled, ReelPilot checks `http://127.0.0.1:8188` during desktop startup and waits up to 90 seconds for ComfyUI to become ready.

Included placeholders:

```text
workflows/wan21-text-to-video.json
workflows/wan21-image-to-video.json
workflows/wan22-text-to-video.json
workflows/wan22-image-to-video.json
workflows/custom-example.json
workflows/workflow-node-map.example.json
```

Recommended local starter settings:

```text
width: 576
height: 1024
fps: 16
frames: 81 or less
steps: 20
guidance: 5
```

Apple Silicon MacBooks may need smaller dimensions, fewer frames, or lower steps. Many AI video workflows are optimized for NVIDIA CUDA GPUs, so local Wan rendering may be slow. If local render fails, switch the provider back to **Veo 3** or **Mock**. For production quality, Veo 3 may still be better. For saving credits, local Wan is useful for drafts, testing, and lower-cost content.

Local outputs are normalized by FFmpeg to vertical `1080x1920` MP4 scene clips in:

```text
storage/scenes/local-wan
```

Then ReelPilot uses the existing final render path: stitch scenes, add voiceover, add optional music, burn captions, apply watermark, and export the final MP4.

## Regenerating UGC Scenes

Open a UGC project and scroll to **UGC Storyboard Review**. Each scene has:

- clip preview
- narration
- prompt
- shot type
- status
- Edit Prompt
- Regenerate Scene
- Approve Scene

Use scene-level regeneration when only one shot is weak. Use **Generate UGC Video** again when you want a new script, storyboard, and full set of clips.

## Known Limitations

- Direct TikTok and Instagram posting is not implemented yet. Kids stories can upload completed videos, metadata, tags, and thumbnails to YouTube.
- Uploaded music is mixed locally, but preset music names need matching MP3 files to render audio.
- Fallback visual backgrounds are simple generated gradients, not AI image/video scenes yet.
- Caption styles beyond Bold Stroke, Red Highlight, Sleek, and Karaoke map to simple ASS styling.
- Video generation runs in a request lifecycle for MVP simplicity, so long renders can keep the browser waiting.
- Real AI video generation depends on external APIs.
- Character consistency may vary by provider.
- Story Video Mode takes longer than Background Mode because each scene is generated separately.
- UGC exact likeness and exact packaging consistency may vary by provider.
- UGC generation can take longer because it creates multiple Veo clips before rendering the final ad.

## Troubleshooting

### Blank Video Or Missing Background

ReelPilot creates reusable fallback backgrounds in:

```text
storage/backgrounds
```

Every render should select one of these files before FFmpeg starts. If a video exports with audio/captions but no visuals, open **Settings** and click **Test FFmpeg**. This creates:

```text
storage/exports/test-visual-render.mp4
```

That test does not use OpenAI, so it confirms the local visual render path by itself.

### Confirm FFmpeg Path

Packaged Windows builds use bundled tools automatically. For local development, check `.env.local` only if you want to override the detected bundled tool:

```bash
FFMPEG_PATH=vendor/win/ffmpeg.exe
```

Then run:

```bash
npm run check:ffmpeg
```

To inspect supported visual/caption filters on Windows:

```bash
vendor\win\ffmpeg.exe -hide_banner -filters
```

### Inspect Generated Files

Look in:

```text
storage/voiceovers
storage/captions
storage/scenes
storage/storyboards
storage/backgrounds
storage/exports
```

Each successful video should have a voiceover MP3, caption file, selected background, and final MP4 export.

### Troubleshooting Scene Generation

Open **Settings** and click **Test Story Video Mode**. This creates:

```text
storage/exports/test-story-video.mp4
```

That test uses the mock provider and does not require OpenAI or external video APIs.

If scene generation fails:

- Check the video detail page for scene statuses and error messages.
- Use **Regenerate scene** on a failed scene.
- Edit a scene prompt, then rerun that scene.
- If the provider path fails, ReelPilot falls back to the background renderer for full video generation.

### Troubleshooting Local ComfyUI + Wan

- **ComfyUI is unreachable:** Start ComfyUI and confirm `http://127.0.0.1:8188` opens.
- **Workflow JSON missing:** Export your Wan workflow from ComfyUI and place it in `workflows/`, or set an absolute custom workflow path in Settings.
- **Node mapping failed:** Open `workflows/workflow-node-map.example.json` and match the node IDs and input names from your workflow.
- **Local Wan only renders a generic background:** The workflow is probably still using its built-in prompt. Open the video or UGC detail page, check **Local Provider Logs**, then open the saved `storage/comfyui/workflows/submitted-*.json` file. Confirm the storyboard prompt appears on the actual text encode node used by your Wan workflow. If it appears on the wrong node, update the Node Mapping JSON in Settings.
- **FaceMismatch / face consistency verification failed:** Your ComfyUI workflow is using a face-consistency or image-reference node, often from a cloud API/custom node. Switch ReelPilot Settings to **Text-to-Video** for first tests, or disable that face consistency node in the ComfyUI workflow. If you need image-to-video, use a clearer single-person creator reference and make sure every face reference in the workflow matches the same person.
- **Generation exceeds timeout:** Lower frames, dimensions, or steps, then increase timeout minutes if needed.
- **No generated video found:** Check your ComfyUI output folder and make sure your workflow has a video save node.
- **Output does not normalize:** Confirm FFmpeg works with `npm run check:ffmpeg`.

## Future Roadmap

- YouTube Shorts upload using YouTube Data API
- TikTok Content Posting API
- Instagram Graph API publishing
- Stripe billing
- Supabase cloud mode
- Multi-user SaaS mode
- Cloud video rendering
- Expanded cloud and local AI video generation presets
- Brand kits
- Content calendar
