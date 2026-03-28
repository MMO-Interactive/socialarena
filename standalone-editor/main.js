const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { fileURLToPath, pathToFileURL } = require("url");

const DOC_ROOT = path.resolve(__dirname, "..");
const HELP_DOCS = {
  featureSpec: path.join(DOC_ROOT, "STANDALONE_EDITOR_V1_FEATURE_SPEC.md"),
  architecture: path.join(DOC_ROOT, "STANDALONE_EDITOR_ARCHITECTURE.md"),
  apiContract: path.join(DOC_ROOT, "STANDALONE_EDITOR_API_CONTRACT.md")
};

function extractApiErrorMessage(data, response) {
  if (data?.error?.message) {
    return data.error.message;
  }
  if (typeof data?.error === "string") {
    return data.error;
  }
  if (typeof data?.message === "string") {
    return data.message;
  }
  return `API request failed with status ${response.status}`;
}

async function editorApiRequest(payload) {
  const baseUrl = String(payload?.baseUrl || "").replace(/\/+$/, "");
  const apiPath = String(payload?.path || "").replace(/^\/+/, "");

  if (!baseUrl || !apiPath) {
    throw new Error("API base URL and path are required.");
  }

  const headers = {
    Accept: "application/json"
  };

  if (payload?.token) {
    headers.Authorization = `Bearer ${payload.token}`;
    headers["X-Editor-Session"] = payload.token;
  }

  if (payload?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}/${apiPath}`, {
    method: payload?.method || "GET",
    headers,
    body: payload?.body !== undefined ? JSON.stringify(payload.body) : undefined
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    const message = extractApiErrorMessage(data, response);
    const apiError = new Error(message);
    apiError.status = response.status;
    apiError.payload = data;
    throw apiError;
  }

  if (data === null) {
    throw new Error("API returned an empty or invalid JSON response.");
  }

  return data;
}

function normalizeIpcError(error) {
  if (!error) {
    return new Error("Unknown error");
  }

  const payloadMessage = error.payload?.error?.message
    || error.payload?.error
    || error.payload?.message;
  const normalized = new Error(payloadMessage || error.message || "Request failed");
  if (error.status) {
    normalized.status = error.status;
  }
  if (error.payload) {
    normalized.payload = error.payload;
  }
  return normalized;
}

function toSafeExportName(value, fallback = "socialarena-export") {
  const normalized = String(value || fallback)
    .replace(/[<>:"/\\|?*]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return normalized || fallback;
}

function parseDurationSeconds(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  const text = String(value || "").trim();
  if (!text) {
    return fallback;
  }

  const secMatch = text.match(/^(\d+(?:\.\d+)?)\s*sec$/i);
  if (secMatch) {
    return Number(secMatch[1]);
  }

  const parts = text.split(":").map((entry) => Number(entry));
  if (parts.length === 4 && parts.every((entry) => Number.isFinite(entry))) {
    const [hours, minutes, seconds, frames] = parts;
    return hours * 3600 + minutes * 60 + seconds + frames / 24;
  }

  if (parts.length === 3 && parts.every((entry) => Number.isFinite(entry))) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  const numeric = Number(text);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
}

function getItemDuration(item) {
  if (!item) {
    return 0;
  }

  if (typeof item.durationSeconds === "number" && Number.isFinite(item.durationSeconds)) {
    return Math.max(0, item.durationSeconds);
  }

  return parseDurationSeconds(item.sourceOut, item.kind === "image" || item.kind === "title" ? 3 : 5);
}

function getSourcePath(item) {
  if (item?.sourcePath) {
    return item.sourcePath;
  }

  if (typeof item?.sourceUrl === "string" && item.sourceUrl.startsWith("file://")) {
    try {
      return fileURLToPath(item.sourceUrl);
    } catch (error) {
      return "";
    }
  }

  if (typeof item?.sourceUrl === "string" && /^[a-zA-Z]:\\/.test(item.sourceUrl)) {
    return item.sourceUrl;
  }

  return typeof item?.sourceUrl === "string" ? item.sourceUrl : "";
}

function getTrackItems(project, prefix) {
  return Array.isArray(project?.timeline?.tracks)
    ? project.timeline.tracks.filter((track) => String(track.id || "").startsWith(prefix))
    : [];
}

function getTimelineDuration(project) {
  const explicitDuration = Number(project?.timeline?.duration || 0);
  const computed = getTrackItems(project, "")
    .flatMap((track) => Array.isArray(track.items) ? [track.items.reduce((sum, item) => sum + getItemDuration(item), 0)] : [])
    .reduce((max, duration) => Math.max(max, duration), 0);
  return Math.max(explicitDuration, computed, 1);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      ...options
    });

    let stderr = "";
    let stdout = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(stderr.trim() || `Command failed with exit code ${code}`);
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

async function sourceHasAudioStream(sourcePath) {
  try {
    const result = await runCommand("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=index",
      "-of",
      "csv=p=0",
      sourcePath
    ]);
    return Boolean(String(result.stdout || "").trim());
  } catch (error) {
    return false;
  }
}

async function extractVideoFrame(sourcePath, seconds, outputPath) {
  await runCommand("ffmpeg", [
    "-y",
    "-ss",
    Math.max(0, seconds).toFixed(3),
    "-i",
    sourcePath,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath
  ]);
  return outputPath;
}

async function generateBridgeClipLocal(payload = {}) {
  const beforeItem = payload.beforeItem || {};
  const afterItem = payload.afterItem || {};
  const beforePath = getSourcePath(beforeItem);
  const afterPath = getSourcePath(afterItem);

  if (!beforePath || !afterPath) {
    throw new Error("Bridge generation requires two local video clips.");
  }

  const durationSeconds = Math.max(0.6, Math.min(8, Number(payload.durationSeconds || 2)));
  const fps = Math.max(12, Math.min(60, Number(payload.fps || 24)));
  const fadeDuration = Math.min(0.6, Math.max(0.2, durationSeconds * 0.35));
  const fadeStart = Math.max(0, durationSeconds - fadeDuration);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "socialarena-bridge-"));
  const beforeFrame = path.join(tempDir, "before.jpg");
  const afterFrame = path.join(tempDir, "after.jpg");
  const outputPath = path.join(tempDir, "bridge.mp4");

  await extractVideoFrame(beforePath, Math.max(0, getItemDuration(beforeItem) - 0.08), beforeFrame);
  await extractVideoFrame(afterPath, 0, afterFrame);

  const scale = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black`;
  await runCommand("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-t",
    durationSeconds.toFixed(3),
    "-i",
    beforeFrame,
    "-loop",
    "1",
    "-t",
    durationSeconds.toFixed(3),
    "-i",
    afterFrame,
    "-filter_complex",
    `[0:v]${scale},fps=${fps},format=yuv420p[base];` +
    `[1:v]${scale},fps=${fps},format=rgba,fade=t=in:st=${fadeStart.toFixed(3)}:d=${fadeDuration.toFixed(3)}:alpha=1[overlay];` +
    `[base][overlay]overlay=(W-w)/2:(H-h)/2:format=auto,format=yuv420p[v]`,
    "-map",
    "[v]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    outputPath
  ]);

  return {
    filePath: outputPath,
    fileUrl: pathToFileURL(outputPath).href,
    beforeFrameUrl: pathToFileURL(beforeFrame).href,
    afterFrameUrl: pathToFileURL(afterFrame).href,
    durationSeconds
  };
}

function resolveExportSettings(project, settings = {}) {
  const resolutionMap = {
    "1920x1080": { width: 1920, height: 1080 },
    "1280x720": { width: 1280, height: 720 },
    "1080x1920": { width: 1080, height: 1920 }
  };
  const qualityMap = {
    high: { preset: "medium", crf: "18" },
    balanced: { preset: "veryfast", crf: "22" },
    fast: { preset: "ultrafast", crf: "28" }
  };

  const resolution = resolutionMap[settings.resolution] || resolutionMap["1920x1080"];
  const quality = qualityMap[settings.quality] || qualityMap.balanced;

  return {
    ...resolution,
    fps: Number(settings.fps || project?.fps || project?.timeline?.fps || 24),
    includeAudio: settings.includeAudio !== false,
    preset: quality.preset,
    crf: quality.crf
  };
}

function normalizeTransition(transition = {}) {
  const validTypes = new Set(["cut", "crossfade", "dip_black", "wipe_left"]);
  const type = validTypes.has(transition?.type) ? transition.type : "cut";
  const duration = Math.max(0.05, Math.min(2, Number(transition?.duration || 0.4)));
  return { type, duration };
}

function getTransitionEffect(type) {
  if (type === "dip_black") {
    return "fadeblack";
  }
  if (type === "wipe_left") {
    return "wipeleft";
  }
  return "fade";
}

async function renderVideoSegment(item, tempDir, settings, index) {
  const duration = Math.max(0.1, getItemDuration(item));
  const outputPath = path.join(tempDir, `segment-${String(index).padStart(3, "0")}.mp4`);
  const sourcePath = getSourcePath(item);
  const scaleFilter = `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease,pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black,fps=${settings.fps},format=yuv420p`;

  if ((item.kind === "image" || item.kind === "title") && sourcePath) {
    await runCommand("ffmpeg", [
      "-y",
      "-loop",
      "1",
      "-t",
      duration.toFixed(3),
      "-i",
      sourcePath,
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-shortest",
      "-vf",
      scaleFilter,
      "-c:v",
      "libx264",
      "-preset",
      settings.preset,
      "-crf",
      settings.crf,
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      outputPath
    ]);
    return outputPath;
  }

  if (sourcePath) {
    const hasAudio = await sourceHasAudioStream(sourcePath);
    const volume = Math.max(0, Math.min(2, Number(item.volume ?? 100) / 100));
    const args = [
      "-y",
      "-i",
      sourcePath
    ];

    if (!hasAudio) {
      args.push(
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=48000"
      );
    }

    args.push(
      "-t",
      duration.toFixed(3),
      "-vf",
      scaleFilter
    );

    if (hasAudio) {
      args.push("-af", `volume=${volume}`);
    }

    args.push(
      "-map",
      "0:v:0",
      "-map",
      hasAudio ? "0:a:0" : "1:a:0",
      "-shortest",
      "-c:v",
      "libx264",
      "-preset",
      settings.preset,
      "-crf",
      settings.crf,
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      outputPath
    );

    await runCommand("ffmpeg", args);
    return outputPath;
  }

  await runCommand("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${duration.toFixed(3)}`,
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-shortest",
    "-c:v",
    "libx264",
    "-preset",
    settings.preset,
    "-crf",
    settings.crf,
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    outputPath
  ]);
  return outputPath;
}

async function buildVideoTrack(project, tempDir, settings, onProgress) {
  const videoTracks = getTrackItems(project, "video");
  const items = videoTracks[0]?.items || [];

  if (!items.length) {
    const outputPath = path.join(tempDir, "video-base.mp4");
    const duration = getTimelineDuration(project);
    onProgress?.(20, "Generating base video");
    await runCommand("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=black:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${duration.toFixed(3)}`,
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-shortest",
      "-c:v",
      "libx264",
      "-preset",
      settings.preset,
      "-crf",
      settings.crf,
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      outputPath
    ]);
    return outputPath;
  }

  const segments = [];
  for (let index = 0; index < items.length; index += 1) {
    onProgress?.(10 + Math.round(((index + 1) / items.length) * 45), `Rendering video segment ${index + 1} of ${items.length}`);
    segments.push(await renderVideoSegment(items[index], tempDir, settings, index));
  }

  const transitions = items.slice(0, -1).map((item, index) => {
    const nextItem = items[index + 1];
    const transition = normalizeTransition(item.transition);
    const currentDuration = Math.max(0.1, getItemDuration(item));
    const nextDuration = Math.max(0.1, getItemDuration(nextItem));
    const safeDuration = Math.max(
      transition.type === "cut" ? 0.05 : 0.1,
      Math.min(transition.duration, currentDuration - 0.05, nextDuration - 0.05, 2)
    );

    return {
      type: transition.type,
      duration: Number(safeDuration.toFixed(3))
    };
  });

  const hasTransitions = transitions.some((transition) => transition.type !== "cut");

  if (hasTransitions) {
    const outputPath = path.join(tempDir, "video-track.mp4");
    const args = ["-y"];
    segments.forEach((segmentPath) => {
      args.push("-i", segmentPath);
    });

    const filterParts = [];
    let currentVideoLabel = "[0:v]";
    let currentAudioLabel = "[0:a]";
    let accumulatedDuration = Math.max(0.1, getItemDuration(items[0]));
    let totalOverlap = 0;

    for (let index = 1; index < items.length; index += 1) {
      const transition = transitions[index - 1];
      const overlap = transition.duration;
      const offset = Math.max(0, accumulatedDuration - totalOverlap - overlap);
      const nextVideoInput = `[${index}:v]`;
      const nextAudioInput = `[${index}:a]`;
      const nextVideoLabel = index === items.length - 1 ? "[vout]" : `[v${index}]`;
      const nextAudioLabel = index === items.length - 1 ? "[aout]" : `[a${index}]`;
      const videoEffect = getTransitionEffect(transition.type);

      filterParts.push(
        `${currentVideoLabel}${nextVideoInput}xfade=transition=${videoEffect}:duration=${overlap.toFixed(3)}:offset=${offset.toFixed(3)}${nextVideoLabel}`
      );
      filterParts.push(
        `${currentAudioLabel}${nextAudioInput}acrossfade=d=${overlap.toFixed(3)}${nextAudioLabel}`
      );

      currentVideoLabel = nextVideoLabel;
      currentAudioLabel = nextAudioLabel;
      accumulatedDuration += Math.max(0.1, getItemDuration(items[index]));
      totalOverlap += overlap;
    }

    onProgress?.(60, "Assembling video track with transitions");
    args.push(
      "-filter_complex",
      filterParts.join(";"),
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-preset",
      settings.preset,
      "-crf",
      settings.crf,
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      outputPath
    );

    await runCommand("ffmpeg", args);
    return outputPath;
  }

  const listPath = path.join(tempDir, "segments.txt");
  await fs.writeFile(
    listPath,
    segments.map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`).join("\n"),
    "utf8"
  );

  const outputPath = path.join(tempDir, "video-track.mp4");
  onProgress?.(60, "Assembling video track");
  await runCommand("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outputPath
  ]);
  return outputPath;
}

async function buildExtraAudioTrack(project, tempDir, onProgress) {
  const audioTracks = getTrackItems(project, "audio")
    .map((track) => ({
      ...track,
      items: Array.isArray(track.items) ? track.items.filter((item) => getSourcePath(item)) : []
    }))
    .filter((track) => track.items.length);
  const validItems = audioTracks.flatMap((track) => track.items);

  if (!validItems.length) {
    return "";
  }

  const args = ["-y"];
  const filterParts = [];
  const audioLabels = [];
  let inputIndex = 0;

  audioTracks.forEach((track) => {
    let cursor = 0;
    track.items.forEach((item) => {
      args.push("-i", getSourcePath(item));
      const duration = Math.max(0.1, getItemDuration(item));
      const delayMs = Math.round(cursor * 1000);
      const volume = Math.max(0, Math.min(2, Number(item.volume ?? 100) / 100));
      filterParts.push(
        `[${inputIndex}:a]atrim=0:${duration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${volume},adelay=${delayMs}|${delayMs}[a${inputIndex}]`
      );
      audioLabels.push(`[a${inputIndex}]`);
      cursor += duration;
      inputIndex += 1;
    });
  });

  const outputPath = path.join(tempDir, "audio-track.m4a");
  const filterComplex = `${filterParts.join(";")};${audioLabels.join("")}amix=inputs=${audioLabels.length}:normalize=0[aout]`;
  onProgress?.(75, "Mixing timeline audio");
  args.push(
    "-filter_complex",
    filterComplex,
    "-map",
    "[aout]",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    outputPath
  );

  await runCommand("ffmpeg", args);
  return outputPath;
}

async function exportTimelineProject(project, destinationPath, exportSettings, onProgress) {
  const settings = resolveExportSettings(project, exportSettings);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "socialarena-export-"));

  try {
    onProgress?.(5, "Preparing export");
    const videoPath = await buildVideoTrack(project, tempDir, settings, onProgress);
    const extraAudioPath = settings.includeAudio ? await buildExtraAudioTrack(project, tempDir, onProgress) : "";

    if (extraAudioPath) {
      onProgress?.(90, "Finalizing export");
      await runCommand("ffmpeg", [
        "-y",
        "-i",
        videoPath,
        "-i",
        extraAudioPath,
        "-filter_complex",
        "[0:a][1:a]amix=inputs=2:normalize=0[aout]",
        "-map",
        "0:v:0",
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        destinationPath
      ]);
    } else {
      onProgress?.(90, "Writing export");
      await fs.copyFile(videoPath, destinationPath);
    }
    onProgress?.(100, "Export complete");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#111827",
    title: "SocialArena Editor",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile(path.join(__dirname, "index.html"));

  return window;
}

function sendMenuAction(action, payload = {}) {
  const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!window || window.isDestroyed()) {
    return;
  }

  window.webContents.send("editor:menu-action", {
    action,
    ...payload
  });
}

async function openHelpDoc(filePath) {
  await shell.openPath(filePath);
}

function menuActionItem(label, action, options = {}) {
  return {
    label,
    accelerator: options.accelerator,
    click: () =>
      sendMenuAction(action, {
        notice: options.notice,
        tone: options.tone || "neutral"
      })
  };
}

function buildAppMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" }
            ]
          }
        ]
      : []),
    {
      label: "File",
      submenu: [
        menuActionItem("New Project", "new-project", { accelerator: "CmdOrCtrl+N" }),
        menuActionItem("Open Project...", "open-project", { accelerator: "CmdOrCtrl+O" }),
        { type: "separator" },
        menuActionItem("Save Project", "save-project", { accelerator: "CmdOrCtrl+S" }),
        menuActionItem("Save Project As...", "save-project-as", { accelerator: "CmdOrCtrl+Shift+S" }),
        { type: "separator" },
        menuActionItem("Import Assets...", "import-assets", { accelerator: "CmdOrCtrl+I" }),
        menuActionItem("Import Folder...", "menu-placeholder", {
          accelerator: "CmdOrCtrl+Shift+I",
          notice: "Folder ingest is not implemented yet."
        }),
        menuActionItem("Add Selected Asset To Timeline", "add-to-timeline", { accelerator: "CmdOrCtrl+Enter" }),
        { type: "separator" },
        menuActionItem("Export", "export-project", { accelerator: "CmdOrCtrl+E" }),
        menuActionItem("Export Script...", "export-script", { accelerator: "CmdOrCtrl+Shift+E" }),
        menuActionItem("Queue Background Render", "menu-placeholder", {
          notice: "Background render queue is not implemented yet."
        }),
        { type: "separator" },
        menuActionItem("Project Settings", "menu-placeholder", {
          accelerator: "CmdOrCtrl+,",
          notice: "Project settings are not implemented yet."
        }),
        menuActionItem("Preferences", "menu-placeholder", {
          accelerator: "CmdOrCtrl+Alt+,",
          notice: "Application preferences are not implemented yet."
        }),
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "delete" },
        { role: "selectAll" }
      ]
    },
    {
      label: "Studio",
      submenu: [
        menuActionItem("Dashboard", "open-dashboard", { accelerator: "CmdOrCtrl+Shift+D" }),
        menuActionItem("Editor Workspace", "open-editor", { accelerator: "CmdOrCtrl+Shift+E" }),
        { type: "separator" },
        menuActionItem("Browse Platform", "open-platform-browser", { accelerator: "CmdOrCtrl+Shift+B" }),
        menuActionItem("Sync Current Project", "sync-project", { accelerator: "CmdOrCtrl+Shift+Y" }),
        { type: "separator" },
        menuActionItem("Dashboard", "open-dashboard"),
        menuActionItem("Project Library", "open-studio-project-library"),
        menuActionItem("Story Board", "open-studio-story-board"),
        menuActionItem("Scene Planner", "open-studio-scene-planner"),
        menuActionItem("Clip Composer", "open-studio-clip-composer"),
        { type: "separator" },
        menuActionItem("Studios", "open-studio-studios"),
        menuActionItem("Series", "open-studio-series"),
        menuActionItem("Episodes", "open-studio-episodes"),
        menuActionItem("Talent", "open-studio-talent"),
        menuActionItem("Locations", "open-studio-locations"),
        menuActionItem("Props", "open-studio-props")
      ]
    },
    {
      label: "Workflow",
      submenu: [
        menuActionItem("Previous Stage", "previous-stage", { accelerator: "CmdOrCtrl+[" }),
        menuActionItem("Next Stage", "next-stage", { accelerator: "CmdOrCtrl+]" }),
        { type: "separator" },
        { label: "Idea Board", accelerator: "CmdOrCtrl+1", click: () => sendMenuAction("jump-stage", { stageId: "idea_board" }) },
        { label: "Project Pitch", accelerator: "CmdOrCtrl+2", click: () => sendMenuAction("jump-stage", { stageId: "project_pitch" }) },
        { label: "Script", accelerator: "CmdOrCtrl+3", click: () => sendMenuAction("jump-stage", { stageId: "script" }) },
        { label: "Starting Images", accelerator: "CmdOrCtrl+4", click: () => sendMenuAction("jump-stage", { stageId: "starting_images" }) },
        { label: "Video Clips", accelerator: "CmdOrCtrl+5", click: () => sendMenuAction("jump-stage", { stageId: "video_clips" }) },
        { label: "Edit", accelerator: "CmdOrCtrl+6", click: () => sendMenuAction("jump-stage", { stageId: "edit" }) }
      ]
    },
    {
      label: "Generate",
      submenu: [
        menuActionItem("Image Generation", "menu-placeholder", {
          accelerator: "CmdOrCtrl+Shift+1",
          notice: "Image generation panel is not implemented yet."
        }),
        menuActionItem("Video Generation", "menu-placeholder", {
          accelerator: "CmdOrCtrl+Shift+2",
          notice: "Video generation panel is not implemented yet."
        }),
        menuActionItem("Audio Generation", "menu-placeholder", {
          accelerator: "CmdOrCtrl+Shift+3",
          notice: "Audio generation panel is not implemented yet."
        }),
        menuActionItem("Prompt Builder", "menu-placeholder", {
          notice: "Prompt builder is not implemented yet."
        }),
        menuActionItem("Model Presets", "menu-placeholder", {
          notice: "Model presets are not implemented yet."
        }),
        menuActionItem("Generation Queue", "menu-placeholder", {
          notice: "Generation queue is not implemented yet."
        }),
        menuActionItem("Comfy Workflows", "menu-placeholder", {
          notice: "Comfy workflow management is not implemented yet."
        }),
        menuActionItem("Batch Generate", "menu-placeholder", {
          notice: "Batch generation is not implemented yet."
        })
      ]
    },
    {
      label: "Assets",
      submenu: [
        menuActionItem("Import Assets...", "import-assets", { accelerator: "CmdOrCtrl+I" }),
        menuActionItem("Browse Media Bin", "open-assets-media-bin"),
        menuActionItem("Preview Selected Asset", "open-selected-asset-preview", { accelerator: "Space" }),
        menuActionItem("Close Asset Preview", "close-asset-preview", { accelerator: "Escape" }),
        { type: "separator" },
        menuActionItem("Generated Images", "open-assets-generated-images"),
        menuActionItem("Generated Videos", "open-assets-generated-videos"),
        menuActionItem("Music Library", "open-assets-music-library"),
        menuActionItem("Voice Library", "open-assets-voice-library"),
        menuActionItem("Brand Assets", "open-assets-brand-assets"),
        { type: "separator" },
        menuActionItem("Tag Asset", "tag-selected-asset"),
        menuActionItem("Approve Asset", "approve-selected-asset"),
        menuActionItem("Reject Asset", "reject-selected-asset")
      ]
    },
    {
      label: "Timeline",
      submenu: [
        menuActionItem("Add Selected Asset To Timeline", "add-to-timeline", { accelerator: "CmdOrCtrl+Enter" }),
        menuActionItem("Insert Video Track", "menu-placeholder", { notice: "Track insertion is not implemented yet." }),
        menuActionItem("Insert Audio Track", "menu-placeholder", { notice: "Track insertion is not implemented yet." }),
        menuActionItem("Insert Title Track", "menu-placeholder", { notice: "Track insertion is not implemented yet." }),
        { type: "separator" },
        menuActionItem("Split Clip", "menu-placeholder", { accelerator: "CmdOrCtrl+K", notice: "Clip splitting is not implemented yet." }),
        menuActionItem("Trim To Playhead", "menu-placeholder", { notice: "Timeline trimming is not implemented yet." }),
        menuActionItem("Ripple Delete", "menu-placeholder", { notice: "Ripple delete is not implemented yet." }),
        menuActionItem("Snap To Grid", "menu-placeholder", { notice: "Timeline snapping is not implemented yet." }),
        menuActionItem("Zoom Timeline In", "menu-placeholder", { accelerator: "=", notice: "Timeline zoom is not implemented yet." }),
        menuActionItem("Zoom Timeline Out", "menu-placeholder", { accelerator: "-", notice: "Timeline zoom is not implemented yet." }),
        { type: "separator" },
        menuActionItem("Add Marker", "menu-placeholder", { accelerator: "M", notice: "Markers are not implemented yet." }),
        menuActionItem("Jump To Next Marker", "menu-placeholder", { notice: "Markers are not implemented yet." })
      ]
    },
    {
      label: "Playback",
      submenu: [
        menuActionItem("Play", "playback-play", { accelerator: "CmdOrCtrl+P" }),
        menuActionItem("Pause", "playback-pause", { accelerator: "CmdOrCtrl+." }),
        menuActionItem("Stop", "playback-stop", { accelerator: "CmdOrCtrl+Shift+." }),
        menuActionItem("Step Frame", "playback-step", { accelerator: "CmdOrCtrl+Right" }),
        { type: "separator" },
        menuActionItem("Go To Start", "menu-placeholder", { accelerator: "Home", notice: "Transport jumping is not implemented yet." }),
        menuActionItem("Go To End", "menu-placeholder", { accelerator: "End", notice: "Transport jumping is not implemented yet." }),
        menuActionItem("Loop Playback", "menu-placeholder", { notice: "Loop playback is not implemented yet." }),
        menuActionItem("Playback Quality", "menu-placeholder", { notice: "Playback quality controls are not implemented yet." })
      ]
    },
    {
      label: "Audio",
      submenu: [
        menuActionItem("Mixer", "menu-placeholder", { notice: "Audio mixer is not implemented yet." }),
        menuActionItem("Normalize Clip", "menu-placeholder", { notice: "Audio normalization is not implemented yet." }),
        menuActionItem("Fade In", "menu-placeholder", { notice: "Audio fades are not implemented yet." }),
        menuActionItem("Fade Out", "menu-placeholder", { notice: "Audio fades are not implemented yet." }),
        menuActionItem("Duck Under Dialogue", "menu-placeholder", { notice: "Audio ducking is not implemented yet." }),
        menuActionItem("Voice Cleanup", "menu-placeholder", { notice: "Voice cleanup is not implemented yet." }),
        menuActionItem("Music Search", "menu-placeholder", { notice: "Music search is not implemented yet." })
      ]
    },
    {
      label: "Review",
      submenu: [
        menuActionItem("Notes", "menu-placeholder", { notice: "Review notes are not implemented yet." }),
        menuActionItem("Approvals", "menu-placeholder", { notice: "Approval workflow is not implemented yet." }),
        menuActionItem("Compare Versions", "menu-placeholder", { notice: "Version comparison is not implemented yet." }),
        menuActionItem("Activity Feed", "menu-placeholder", { notice: "Activity feed is not implemented yet." })
      ]
    },
    {
      label: "Publish",
      submenu: [
        menuActionItem("Export", "export-project", { accelerator: "CmdOrCtrl+E" }),
        menuActionItem("Publish To SocialArena", "menu-placeholder", { notice: "Direct publishing is not implemented yet." }),
        menuActionItem("Create Social Cutdowns", "menu-placeholder", { notice: "Social cutdown generation is not implemented yet." }),
        menuActionItem("Captions And Subtitles", "menu-placeholder", { notice: "Captions workflow is not implemented yet." }),
        menuActionItem("Thumbnail Builder", "menu-placeholder", { notice: "Thumbnail builder is not implemented yet." }),
        menuActionItem("Channel Packaging", "menu-placeholder", { notice: "Channel packaging is not implemented yet." }),
        menuActionItem("Release Scheduler", "menu-placeholder", { notice: "Release scheduling is not implemented yet." })
      ]
    },
    {
      label: "Jobs",
      submenu: [
        menuActionItem("Generation Queue", "menu-placeholder", { notice: "Generation queue is not implemented yet." }),
        menuActionItem("Sync Queue", "menu-placeholder", { notice: "Sync queue is not implemented yet." }),
        menuActionItem("Export Queue", "menu-placeholder", { notice: "Export queue is not implemented yet." }),
        menuActionItem("Failed Jobs", "menu-placeholder", { notice: "Job diagnostics are not implemented yet." }),
        menuActionItem("Retry Failed Jobs", "menu-placeholder", { notice: "Job retry controls are not implemented yet." })
      ]
    },
    {
      label: "Integrations",
      submenu: [
        menuActionItem("SocialArena Account", "menu-placeholder", { notice: "Account settings are not implemented yet." }),
        menuActionItem("ComfyUI", "menu-placeholder", { notice: "ComfyUI integration settings are not implemented yet." }),
        menuActionItem("FFmpeg", "menu-placeholder", { notice: "FFmpeg settings are not implemented yet." }),
        menuActionItem("Storage Providers", "menu-placeholder", { notice: "Storage integration settings are not implemented yet." }),
        menuActionItem("Publishing Destinations", "menu-placeholder", { notice: "Publishing integrations are not implemented yet." })
      ]
    },
    {
      label: "Account",
      submenu: [
        menuActionItem("Profile", "menu-placeholder", { notice: "Profile settings are not implemented yet." }),
        menuActionItem("Studios And Roles", "menu-placeholder", { notice: "Role management is not implemented yet." }),
        menuActionItem("Usage And Credits", "menu-placeholder", { notice: "Usage tracking is not implemented yet." }),
        { type: "separator" },
        menuActionItem("Log Out", "logout")
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        menuActionItem("Focus Media Bin", "menu-placeholder", { notice: "Panel focus shortcuts are not implemented yet." }),
        menuActionItem("Focus Timeline", "menu-placeholder", { notice: "Panel focus shortcuts are not implemented yet." }),
        menuActionItem("Focus Inspector", "menu-placeholder", { notice: "Panel focus shortcuts are not implemented yet." }),
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac ? [{ type: "separator" }, { role: "front" }] : [{ role: "close" }])
      ]
    },
    {
      label: "Help",
      submenu: [
        { label: "Standalone Editor Feature Spec", click: () => openHelpDoc(HELP_DOCS.featureSpec) },
        { label: "Standalone Editor Architecture", click: () => openHelpDoc(HELP_DOCS.architecture) },
        { label: "Standalone Editor API Contract", click: () => openHelpDoc(HELP_DOCS.apiContract) },
        { type: "separator" },
        menuActionItem("Keyboard Shortcuts", "menu-placeholder", { notice: "Shortcut reference is not implemented yet." }),
        menuActionItem("Release Notes", "menu-placeholder", { notice: "Release notes are not implemented yet." }),
        menuActionItem("Report Issue", "menu-placeholder", { notice: "Issue reporting is not implemented yet." })
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildAppMenu());
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.handle("editor:open-project", async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(window, {
    title: "Open SocialArena Editor Project",
    filters: [
      { name: "SocialArena Project", extensions: ["json", "sa-project"] }
    ],
    properties: ["openFile"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, "utf8");

  return {
    canceled: false,
    filePath,
    content
  };
});

ipcMain.handle("editor:save-project", async (event, payload) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  let filePath = payload?.filePath;

  if (!filePath) {
    const result = await dialog.showSaveDialog(window, {
      title: "Save SocialArena Editor Project",
      defaultPath: "socialarena-project.sa-project.json",
      filters: [
        { name: "SocialArena Project", extensions: ["json", "sa-project"] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    filePath = result.filePath;
  }

  await fs.writeFile(filePath, payload.content, "utf8");

  return {
    canceled: false,
    filePath
  };
});

ipcMain.handle("editor:import-assets", async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(window, {
    title: "Import Local Assets",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Media Files", extensions: ["mp4", "mov", "webm", "mp3", "wav", "png", "jpg", "jpeg", "webp"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const assets = await Promise.all(
    result.filePaths.map(async (filePath) => {
      const stats = await fs.stat(filePath);
      return {
        filePath,
        fileName: path.basename(filePath),
        fileUrl: pathToFileURL(filePath).href,
        extension: path.extname(filePath).toLowerCase(),
        sizeBytes: stats.size
      };
    })
  );

  return {
    canceled: false,
    assets
  };
});

ipcMain.handle("editor:generate-bridge-clip", async (_event, payload) => {
  const result = await generateBridgeClipLocal(payload);
  const stats = await fs.stat(result.filePath);
  return {
    asset: {
      id: `bridge-asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: payload?.name || "Bridge Clip",
      kind: "video",
      meta: `bridge clip · ${result.durationSeconds.toFixed(1)} sec`,
      sourcePath: result.filePath,
      sourceUrl: result.fileUrl,
      thumbnailUrl: result.beforeFrameUrl,
      durationSeconds: result.durationSeconds,
      sizeBytes: stats.size,
      generated: true,
      bridge: {
        prompt: String(payload?.prompt || ""),
        beforeFrameUrl: result.beforeFrameUrl,
        afterFrameUrl: result.afterFrameUrl
      }
    }
  };
});

ipcMain.handle("editor:export-project", async (event, payload) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const projectName = toSafeExportName(payload?.project?.name || "socialarena-export");

  const result = await dialog.showSaveDialog(window, {
    title: "Export SocialArena Timeline",
    defaultPath: `${projectName || "socialarena-export"}.mp4`,
    filters: [{ name: "MP4 Video", extensions: ["mp4"] }]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const sendProgress = (progress, stage) => {
    event.sender.send("editor:export-progress", {
      progress,
      stage
    });
  };

  sendProgress(0, "Starting export");
  await exportTimelineProject(payload?.project || {}, result.filePath, payload?.settings || {}, sendProgress);

  return {
    canceled: false,
    filePath: result.filePath
  };
});

ipcMain.handle("editor:export-script", async (event, payload) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const projectName = toSafeExportName(payload?.projectName || payload?.project?.name || "socialarena-script");
  const result = await dialog.showSaveDialog(window, {
    title: "Export SocialArena Script",
    defaultPath: `${projectName || "socialarena-script"}-script.txt`,
    filters: [
      { name: "Text Document", extensions: ["txt"] },
      { name: "Markdown", extensions: ["md"] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await fs.writeFile(result.filePath, String(payload?.content || ""), "utf8");
  return {
    canceled: false,
    filePath: result.filePath
  };
});

ipcMain.handle("editor:api-login", async (_event, payload) =>
  editorApiRequest({
    baseUrl: payload?.baseUrl,
    path: "auth/editor-login",
    method: "POST",
    body: {
      username: payload?.username,
      password: payload?.password
    }
  })
);

ipcMain.handle("editor:api-refresh", async (_event, payload) => {
  try {
    return await editorApiRequest({
      baseUrl: payload?.baseUrl,
      path: "auth/refresh",
      method: "POST",
      token: payload?.token
    });
  } catch (error) {
    throw normalizeIpcError(error);
  }
});

ipcMain.handle("editor:api-logout", async (_event, payload) => {
  try {
    return await editorApiRequest({
      baseUrl: payload?.baseUrl,
      path: "auth/logout",
      method: "POST",
      token: payload?.token
    });
  } catch (error) {
    throw normalizeIpcError(error);
  }
});

ipcMain.handle("editor:api-request", async (_event, payload) => {
  try {
    return await editorApiRequest({
      baseUrl: payload?.baseUrl,
      path: payload?.path,
      method: payload?.method,
      token: payload?.token,
      body: payload?.body
    });
  } catch (error) {
    throw normalizeIpcError(error);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
