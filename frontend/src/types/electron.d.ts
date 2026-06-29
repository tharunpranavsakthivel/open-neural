/**
 * Type definitions for the Electron API exposed via contextBridge.
 *
 * These types mirror the OpenNeuralElectronApi interface defined in the preload
 * script. They allow TypeScript to recognize `window.electronAPI` in the renderer.
 *
 * @module types/electron
 */

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
  validateSetupPassword(
    password: string,
    confirmPassword: string,
  ): Promise<AuthResult>;

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
  changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthResult>;

  /**
   * Get the backend port for API communication.
   * Returns null if the backend hasn't started yet.
   * @returns The backend port number, or null if not available
   */
  getBackendPort(): Promise<number | null>;

  /**
   * Open a file dialog for CSV/Parquet file selection.
   *
   * @param options - Dialog options
   * @param options.multiSelections - Allow selecting multiple files
   * @param options.title - Custom dialog title
   * @returns Selected file path(s), or null if cancelled
   */
  openFileDialog(options?: {
    multiSelections?: boolean;
    title?: string;
  }): Promise<string | string[] | null>;

  /**
   * Open a directory dialog for export destination selection.
   *
   * @param options - Dialog options
   * @param options.title - Custom dialog title
   * @returns Selected directory path, or null if cancelled
   */
  openDirectoryDialog(options?: { title?: string }): Promise<string | null>;

  /**
   * Open a file or directory in the OS-native file manager.
   *
   * Uses Electron's shell.openPath to reveal the path in Finder (macOS),
   * Explorer (Windows), or the default file manager (Linux).
   *
   * @param path - Absolute path to the file or directory to reveal
   * @returns Promise that resolves when the operation completes
   */
  openPath(path: string): Promise<void>;

  /**
   * Check for interrupted experiments that need recovery action.
   *
   * Called after successful authentication to detect experiments
   * that were interrupted by a crash or unexpected shutdown.
   *
   * @returns CrashCheckResult with list of interrupted experiments
   */
  checkInterruptedExperiments(): Promise<{
    success: boolean;
    error?: string;
    interruptedExperiments: Array<{
      id: string;
      experiment_id_human: string;
      project_id: string;
      project_name?: string;
      status: "interrupted";
      created_at: string;
      started_at?: string;
      best_model_type?: string;
      metrics?: {
        f1?: number;
        auc_roc?: number;
        precision?: number;
        recall?: number;
      };
    }>;
  }>;
}

declare global {
  interface Window {
    electronAPI: OpenNeuralElectronApi;
  }
}

export {};
