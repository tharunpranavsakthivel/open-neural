/**
 * Electron preload bridge for renderer-safe OpenNeural APIs.
 *
 * Exposes a narrow, typed API surface to the renderer process via Electron's
 * contextBridge. This prevents the renderer from accessing Node.js APIs directly
 * and ensures all privileged operations go through explicit IPC handlers.
 *
 * Security considerations:
 * - No Node.js APIs are exposed directly to the renderer
 * - All IPC channels are enumerated in the interface below
 * - Main process handlers validate all inputs before executing
 *
 * @module preload
 */
import { contextBridge, ipcRenderer } from "electron";

/**
 * Result type for authentication operations.
 */
export interface AuthResult {
  /** Whether the authentication operation succeeded */
  success: boolean;
  /** Error message if authentication failed */
  error?: string;
}

/**
 * Information about the current authentication state.
 */
export interface AuthState {
  /** Whether this is the first launch (no password set yet) */
  isFirstLaunch: boolean;
  /** Path to the OpenNeural data directory */
  dataDir: string;
  /** Path to the SQLite database file */
  dbPath: string;
}

/**
 * Main process API exposed to the renderer via contextBridge.
 *
 * All methods are async and return Promises since they communicate
 * with the main process via IPC.
 */
export interface OpenNeuralElectronApi {
  /** Version of the Electron shell */
  readonly shellVersion: string;

  // Auth APIs (Task 16)

  /**
   * Check the current authentication state.
   * Returns whether this is first launch and paths to data directories.
   */
  checkAuthState(): Promise<AuthState>;

  /**
   * Validate a password against the stored bcrypt hash.
   * @param password - The plain-text password to validate
   * @returns AuthResult indicating success or failure
   */
  validatePassword(password: string): Promise<AuthResult>;

  /**
   * Validate a new password during first-time setup.
   * @param password - The plain-text password to validate
   * @param confirmPassword - The confirmation password
   * @returns AuthResult indicating success or failure
   */
  validateSetupPassword(password: string, confirmPassword: string): Promise<AuthResult>;

  /**
   * Store a password hash in the database during first-time setup.
   * @param password - The plain-text password to hash and store
   * @returns AuthResult indicating success or failure
   */
  storePassword(password: string): Promise<AuthResult>;

  /**
   * Change the existing password after validating the current one.
   * @param currentPassword - The current password for validation
   * @param newPassword - The new password to set
   * @returns AuthResult indicating success or failure
   */
  changePassword(currentPassword: string, newPassword: string): Promise<AuthResult>;
}

/**
 * Implementation of the Electron API exposed to the renderer.
 *
 * All methods use ipcRenderer.invoke to call corresponding
 * ipcMain.handle handlers in the main process.
 */
const electronApi: OpenNeuralElectronApi = {
  shellVersion: "0.1.0",

  // Auth APIs
  checkAuthState: () => ipcRenderer.invoke("auth:check-state"),
  validatePassword: (password: string) => ipcRenderer.invoke("auth:validate-password", password),
  validateSetupPassword: (password: string, confirmPassword: string) =>
    ipcRenderer.invoke("auth:validate-setup-password", password, confirmPassword),
  storePassword: (password: string) => ipcRenderer.invoke("auth:store-password", password),
  changePassword: (currentPassword: string, newPassword: string) =>
    ipcRenderer.invoke("auth:change-password", currentPassword, newPassword)
};

contextBridge.exposeInMainWorld("electronAPI", electronApi);
