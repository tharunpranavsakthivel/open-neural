/**
 * Electron main-process entry point for the OpenNeural desktop shell.
 *
 * Exposes no renderer-facing APIs directly; privileged APIs belong in
 * preload.ts through Electron's contextBridge. The process depends on Electron
 * and Node.js runtime modules and creates the initial BrowserWindow.
 *
 * Security configuration:
 * - nodeIntegration: false - Prevents renderer from accessing Node.js APIs
 * - contextIsolation: true - Isolates preload context from renderer
 * - sandbox: true - Runs renderer in OS sandbox
 * - allowRunningInsecureContent: false - Prevents loading insecure content
 * - CSP via headers: Prevents inline scripts and external resource loading
 */
import path from "node:path";
import { app, BrowserWindow, session } from "electron";

/**
 * Content Security Policy string preventing inline scripts and external
 * resource loading as per FR-APP security requirements (TDD §5.1).
 *
 * - default-src 'self': All resources must come from the app itself
 * - script-src 'self': Scripts can only be loaded from the app's origin
 * - style-src 'self' 'unsafe-inline': Styles from app, inline styles allowed
 *   (needed for CSS-in-JS libraries used by the React frontend)
 * - img-src 'self' data:: Images from app or data URIs
 * - connect-src 'self' http://127.0.0.1:*: API calls to local backend only
 * - font-src 'self': Fonts from app only
 * - frame-ancestors 'none': Prevents clickjacking
 * - base-uri 'self': Restricts base element
 * - form-action 'self': Form submissions to same origin only
 */
const CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:*; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

/**
 * Additional security headers applied to all web responses.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin"
};

/**
 * Configure security headers for all HTTP responses via webRequest API.
 * This is called once during app initialization.
 */
function configureSecurityHeaders(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        ...SECURITY_HEADERS
      }
    });
  });
}

/**
 * Creates the initial application window and loads the renderer shell.
 *
 * Configures BrowserWindow with security settings per FR-APP requirements:
 * - nodeIntegration: false (prevents Node.js access in renderer)
 * - contextIsolation: true (isolates preload from renderer context)
 * - sandbox: true (enables OS-level sandbox)
 * - allowRunningInsecureContent: false (blocks insecure mixed content)
 * - webSecurity: true (enforces same-origin policy)
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
      sandbox: true,
      allowRunningInsecureContent: false,
      webSecurity: true
    }
  });

  // Inject CSP meta tag into the loaded page
  mainWindow.webContents.on("dom-ready", () => {
    void mainWindow.webContents.executeJavaScript(`
      (function() {
        const meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = ${JSON.stringify(CONTENT_SECURITY_POLICY)};
        document.head.insertBefore(meta, document.head.firstChild);
      })();
    `);
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
  // Configure security headers before creating windows
  configureSecurityHeaders();

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
