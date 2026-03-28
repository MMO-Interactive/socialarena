const { contextBridge, ipcRenderer } = require("electron");

async function invoke(channel, payload) {
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

contextBridge.exposeInMainWorld("creatorAppV2", {
  getStartupContext: () => invoke("v2:get-startup-context"),
  apiRequest: (payload) => invoke("v2:api-request", payload),
  importAssets: () => invoke("v2:import-assets"),
  onMenuAction: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("v2:menu-action", listener);
    return () => ipcRenderer.removeListener("v2:menu-action", listener);
  }
});
