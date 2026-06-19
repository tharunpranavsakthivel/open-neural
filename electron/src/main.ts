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
import { randomBytes } from "node:crypto";
import { app, BrowserWindow, session, ipcMain } from "electron";
import {
  checkAuthState,
  validatePassword,
  validateSetupPassword,
  storePassword,
  changePassword
} from "./auth";

/**
 * Ephemeral secret generated on each app start for backend authentication.
 *
 * This cryptographically random 32-byte hex string is injected into the
 * Python backend subprocess as the OPENNEURAL_SECRET environment variable.
 * The backend uses this to validate all incoming HTTP requests via the
 * X-OpenNeural-Secret header (Task 29, TDD §5.1).
 *
 * Security properties:
 * - 256 bits of entropy (32 bytes hex = 256 bits)
 * - Generated fresh on every app start
 * - Never persisted to disk
 * - Only shared with the backend via environment variable
 * - Main process can expose this to renderer via IPC for API calls
 */
let EPHEMERAL_SECRET: string | null = null;

/**
 * Generates a cryptographically secure random hex string.
 *
 * @param byteLength - Number of random bytes to generate (default: 32)
 * @returns Hex-encoded string (2 hex chars per byte)
 */
function generateEphemeralSecret(byteLength: number = 32): string {
  return randomBytes(byteLength).toString("hex");
}

/**
 * Returns the ephemeral secret, generating it if needed.
 *
 * This is called by the Python process manager when spawning the backend
 * and by IPC handlers that need to provide it to the renderer.
 *
 * @returns The 64-character hex ephemeral secret
 */
export function getEphemeralSecret(): string {
  if (EPHEMERAL_SECRET === null) {
    EPHEMERAL_SECRET = generateEphemeralSecret(32);
  }
  return EPHEMERAL_SECRET;
}

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

/**
 * Register all IPC handlers for the main process.
 *
 * These handlers are invoked by the renderer via preload.ts using
 * ipcRenderer.invoke. They provide privileged access to:
 * - Authentication (bcrypt validation against SQLite)
 * - File system dialogs
 * - Backend process management
 */
function registerIpcHandlers(): void {
  // Auth handlers (Task 16)

  /**
   * Handler: auth:check-state
   * Checks if this is the first launch by verifying if auth record exists.
   */
  ipcMain.handle("auth:check-state", async () => {
    return checkAuthState();
  });

  /**
   * Handler: auth:validate-password
   * Validates a password against the stored bcrypt hash.
   */
  ipcMain.handle("auth:validate-password", async (_event, password: string) => {
    return validatePassword(password);
  });

  /**
   * Handler: auth:validate-setup-password
   * Validates a new password during first-time setup.
   */
  ipcMain.handle(
    "auth:validate-setup-password",
    async (_event, password: string, confirmPassword: string) => {
      return validateSetupPassword(password, confirmPassword);
    }
  );

  /**
   * Handler: auth:store-password
   * Stores a password hash in the database during first-time setup.
   */
  ipcMain.handle("auth:store-password", async (_event, password: string) => {
    return storePassword(password);
  });

  /**
   * Handler: auth:change-password
   * Changes the existing password after validating the current one.
   */
  ipcMain.handle(
    "auth:change-password",
    async (_event, currentPassword: string, newPassword: string) => {
      return changePassword(currentPassword, newPassword);
    }
  );
}

app.whenReady().then(() => {
  // Generate ephemeral secret on every app start (Task 17)
  // This 256-bit random value is injected into the Python backend
  // via the OPENNEURAL_SECRET environment variable
  const ephemeralSecret = getEphemeralSecret();
  process.env.OPENNEURAL_SECRET = ephemeralSecret;

  // Configure security headers before creating windows
  configureSecurityHeaders();

  // Register IPC handlers before creating windows
  registerIpcHandlers();

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
