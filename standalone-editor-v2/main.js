const { app, BrowserWindow, ipcMain, Menu, dialog } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const { pathToFileURL } = require("url");

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

async function apiRequest(payload) {
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

function createWindow() {
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: "#09111f",
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        { role: "reload" },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "Workflow",
      submenu: [
        { label: "Idea Board", click: () => window.webContents.send("v2:menu-action", { action: "stage", stageId: "idea_board" }) },
        { label: "Idea Pitch", click: () => window.webContents.send("v2:menu-action", { action: "stage", stageId: "idea_pitch" }) },
        { label: "Script", click: () => window.webContents.send("v2:menu-action", { action: "stage", stageId: "script" }) },
        { label: "Starting Images", click: () => window.webContents.send("v2:menu-action", { action: "stage", stageId: "starting_images" }) },
        { label: "Clip Generation", click: () => window.webContents.send("v2:menu-action", { action: "stage", stageId: "clip_generation" }) },
        { label: "Edit", click: () => window.webContents.send("v2:menu-action", { action: "stage", stageId: "edit" }) },
        { label: "Export / Release", click: () => window.webContents.send("v2:menu-action", { action: "stage", stageId: "export_release" }) }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);
  window.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("v2:get-startup-context", async () => ({
    appName: "SocialArena Creator App V2",
    apiBaseUrl: process.env.SOCIALARENA_API_BASE_URL || "http://localhost/adventure/api/v1",
    studioId: process.env.SOCIALARENA_STUDIO_ID || "",
    startedAt: new Date().toISOString()
  }));

  ipcMain.handle("v2:api-request", async (_event, payload) => {
    try {
      return await apiRequest(payload);
    } catch (error) {
      throw normalizeIpcError(error);
    }
  });

  ipcMain.handle("v2:import-assets", async (event) => {
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

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
