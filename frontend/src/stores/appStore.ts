/**
 * Global application state store using Zustand.
 *
 * Manages the backend port (received from Electron main process),
 * authentication state, and the currently selected project.
 *
 * @module stores/appStore
 */
import { create } from "zustand";

/**
 * Authentication status type.
 * - 'setup': First launch, user needs to set a password
 * - 'locked': Password is set, user needs to authenticate
 * - 'unlocked': User is authenticated, app is accessible
 */
export type AuthStatus = "setup" | "locked" | "unlocked";

/**
 * Authentication state from Electron.
 * Re-exported from types/electron for convenience.
 */
export type { AuthState } from "../types/electron";

/**
 * Wizard step identifiers.
 */
export type WizardStep =
  | "projects"
  | "dataset"
  | "preprocessing"
  | "model"
  | "training"
  | "evaluation"
  | "leaderboard"
  | "export"
  | "settings";

/**
 * Project metadata for dashboard display.
 */
export interface Project {
  id: string;
  name: string;
  taskType: "classification" | "regression";
  experimentCount: number;
  updatedAt: string;
}

/**
 * Application state interface.
 */
export interface AppState {
  /** Backend port for API communication, null until fetched from Electron */
  backendPort: number | null;
  /** Current authentication status */
  authStatus: AuthStatus;
  /** Currently selected project ID, null if no project selected */
  currentProjectId: string | null;
  /** Ephemeral secret for backend API authentication */
  backendSecret: string;
}

/**
 * Application store actions interface.
 */
export interface AppActions {
  /** Set the backend port for API communication */
  setBackendPort: (port: number) => void;
  /** Set the authentication status */
  setAuthStatus: (status: AuthStatus) => void;
  /** Set the current project ID */
  setCurrentProject: (projectId: string | null) => void;
  /** Set the backend secret for API communication */
  setBackendSecret: (secret: string) => void;
}

/**
 * Combined application store type.
 */
export type AppStore = AppState & AppActions;

/**
 * Initial application state.
 */
const initialState: AppState = {
  backendPort: null,
  authStatus: "setup",
  currentProjectId: null,
  backendSecret: "dev-secret",
};

/**
 * Global application store using Zustand.
 *
 * Provides reactive state management for the OpenNeural frontend.
 *
 * @example
 * const { backendPort, setBackendPort } = useAppStore();
 * useEffect(() => {
 *   window.electronAPI.getBackendPort().then(port => {
 *     if (port) setBackendPort(port);
 *   });
 * }, []);
 */
export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setBackendPort: (port: number) =>
    set(() => ({
      backendPort: port,
    })),

  setAuthStatus: (status: AuthStatus) =>
    set(() => ({
      authStatus: status,
    })),

  setCurrentProject: (projectId: string | null) =>
    set(() => ({
      currentProjectId: projectId,
    })),

  setBackendSecret: (secret: string) =>
    set(() => ({
      backendSecret: secret,
    })),
}));

/**
 * Hook selector for accessing individual state values.
 * Use this when you only need a specific value to minimize re-renders.
 *
 * @example
 * const backendPort = useAppSelector((state) => state.backendPort);
 * const setBackendPort = useAppSelector((state) => state.setBackendPort);
 */
export const useAppSelector = useAppStore;

/**
 * Get the current backend port from the store.
 * Useful for non-component contexts.
 *
 * @returns The current backend port or null if not set
 */
export function getBackendPort(): number | null {
  return useAppStore.getState().backendPort;
}

/**
 * Get the current authentication status from the store.
 *
 * @returns The current auth status
 */
export function getAuthStatus(): AuthStatus {
  return useAppStore.getState().authStatus;
}

/**
 * Get the current project ID from the store.
 *
 * @returns The current project ID or null if no project selected
 */
export function getCurrentProjectId(): string | null {
  return useAppStore.getState().currentProjectId;
}

/**
 * Get the current backend secret from the store.
 * Useful for non-component contexts (like axios client).
 *
 * @returns The current backend secret
 */
export function getBackendSecret(): string {
  return useAppStore.getState().backendSecret;
}
