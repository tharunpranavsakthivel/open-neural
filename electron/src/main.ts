/**
 * Electron main-process entry point for the OpenNeural desktop shell.
 *
 * Exposes no renderer-facing APIs directly; privileged APIs belong in
 * preload.ts through Electron's contextBridge. The process depends on Electron
 * and Node.js runtime modules and creates the initial BrowserWindow.
 */
import path from "node:path";
import { app, BrowserWindow } from "electron";

/**
 * Creates the initial application window and loads the renderer shell.
 *
 * @returns BrowserWindow instance used as the primary OpenNeural window.
 * @throws Electron may throw if the preload path cannot be resolved or a window
 * cannot be created by the host OS.
 */
function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const rendererUrl = process.env.OPENNEURAL_RENDERER_URL;
  if (rendererUrl !== undefined && rendererUrl.length > 0) {
    void mainWindow.loadURL(rendererUrl);
    return mainWindow;
  }

  void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  return mainWindow;
}

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
