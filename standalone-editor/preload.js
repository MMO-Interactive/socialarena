const { contextBridge, ipcRenderer } = require("electron");

async function invokeEditor(channel, payload) {
  try {
    return await ipcRenderer.invoke(channel, payload);
  } catch (error) {
    const rawMessage = String(error?.message || "Request failed");
    const cleanedMessage = rawMessage.replace(/^Error invoking remote method '[^']+': Error:\s*/i, "").trim();
    const normalized = new Error(cleanedMessage || rawMessage);
    if (error?.status) {
      normalized.status = error.status;
    }
    if (error?.payload) {
      normalized.payload = error.payload;
    }
    throw normalized;
  }
}

contextBridge.exposeInMainWorld("editorShell", {
  appName: "SocialArena Editor",
  openProject: () => invokeEditor("editor:open-project"),
  saveProject: (payload) => invokeEditor("editor:save-project", payload),
  importAssets: () => invokeEditor("editor:import-assets"),
  generateBridgeClip: (payload) => invokeEditor("editor:generate-bridge-clip", payload),
  exportProject: (payload) => invokeEditor("editor:export-project", payload),
  exportScript: (payload) => invokeEditor("editor:export-script", payload),
  apiLogin: (payload) => invokeEditor("editor:api-login", payload),
  apiRefresh: (payload) => invokeEditor("editor:api-refresh", payload),
  apiLogout: (payload) => invokeEditor("editor:api-logout", payload),
  apiRequest: (payload) => invokeEditor("editor:api-request", payload),
  onExportProgress: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("editor:export-progress", listener);
    return () => ipcRenderer.removeListener("editor:export-progress", listener);
  },
  onMenuAction: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("editor:menu-action", listener);
    return () => ipcRenderer.removeListener("editor:menu-action", listener);
  }
});
