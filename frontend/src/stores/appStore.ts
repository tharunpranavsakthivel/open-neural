/**
 * Global application state store using Zustand.
 *
 * Manages the backend port (received from Electron main process), authentication
 * state, and other global UI state. Persists auth state across component mounts.
 *
 * @module stores/appStore
 */
import { create } from "zustand";
import type { AuthState } from "../types/electron";

export type AuthStatus = "loading" | "setup" | "login" | "authenticated";

/** Wizard step identifiers */
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
  /** Backend port for API communication, null until fetched */
  backendPort: number | null;
  /** Whether backend port is being fetched */
  isLoadingPort: boolean;
  /** Current authentication status */
  authStatus: AuthStatus;
  /** Authentication state from Electron */
  authState: AuthState | null;
  /** Error message if initialization failed */
  error: string | null;
  /** Currently active wizard step */
  currentStep: WizardStep;
  /** Currently selected project ID, null if on projects dashboard */
  currentProjectId: string | null;
  /** Currently active experiment ID for training/evaluation */
  currentExperimentId: string | null;
  /** List of projects for the dashboard */
  projects: Project[];
  /** Whether a project is currently being created/edited */
  isProjectModalOpen: boolean;
  /** Current toast message */
  toast: { message: string; type: "success" | "error" } | null;
  /** Ephemeral secret for backend API authentication */
  backendSecret: string;
}

/**
 * Application store interface including state and actions.
 */
export interface AppActions {
  /** Set the backend port */
  setBackendPort: (port: number) => void;
  /** Set loading state for port fetch */
  setIsLoadingPort: (loading: boolean) => void;
  /** Set authentication status */
  setAuthStatus: (status: AuthStatus) => void;
  /** Set authentication state */
  setAuthState: (state: AuthState) => void;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Complete authentication flow */
  setAuthenticated: () => void;
  /** Navigate to a wizard step */
  setCurrentStep: (step: WizardStep) => void;
  /** Set the current experiment ID */
  setCurrentExperimentId: (experimentId: string | null) => void;
  /** Set the current project ID directly */
  setCurrentProjectId: (projectId: string | null) => void;
  /** Select a project and navigate to dataset step */
  selectProject: (projectId: string) => void;
  /** Return to projects dashboard */
  goToProjects: () => void;
  /** Set projects list */
  setProjects: (projects: Project[]) => void;
  /** Open project creation modal */
  openProjectModal: () => void;
  /** Close project creation modal */
  closeProjectModal: () => void;
  /** Show success toast message */
  showSuccessToast: (message: string) => void;
  /** Show error toast message */
  showErrorToast: (message: string) => void;
  /** Clear toast message */
  clearToast: () => void;
  /** Set the backend secret for API communication */
  setBackendSecret: (secret: string) => void;
  /** Set the current project ID */
  setCurrentProject: (projectId: string | null) => void;
}

export type AppStore = AppState & AppActions;

const initialState: AppState = {
  backendPort: null,
  isLoadingPort: true,
  authStatus: "loading",
  authState: null,
  error: null,
  currentStep: "projects",
  currentProjectId: null,
  currentExperimentId: null,
  projects: [],
  isProjectModalOpen: false,
  toast: null,
  backendSecret: "dev-secret",
};

/**
 * Global application store using Zustand.
 *
 * Provides reactive state management for the OpenNeural frontend.
 */
export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setBackendPort: (port: number) =>
    set(() => ({
      backendPort: port,
    })),

  setIsLoadingPort: (loading: boolean) =>
    set(() => ({
      isLoadingPort: loading,
    })),

  setAuthStatus: (status: AuthStatus) =>
    set(() => ({
      authStatus: status,
    })),

  setAuthState: (state: AuthState) =>
    set(() => ({
      authState: state,
    })),

  setError: (err: string | null) =>
    set(() => ({
      error: err,
    })),

  setAuthenticated: () =>
    set(() => ({
      authStatus: "authenticated",
    })),

  setCurrentStep: (step: WizardStep) =>
    set(() => ({
      currentStep: step,
    })),

  setCurrentExperimentId: (experimentId: string | null) =>
    set(() => ({
      currentExperimentId: experimentId,
    })),

  setCurrentProjectId: (projectId: string | null) =>
    set(() => ({
      currentProjectId: projectId,
    })),

  selectProject: (projectId: string) =>
    set(() => ({
      currentProjectId: projectId,
      currentStep: "dataset",
    })),

  goToProjects: () =>
    set(() => ({
      currentStep: "projects",
      currentProjectId: null,
    })),

  setProjects: (projectsList: Project[]) =>
    set(() => ({
      projects: projectsList,
    })),

  openProjectModal: () =>
    set(() => ({
      isProjectModalOpen: true,
    })),

  closeProjectModal: () =>
    set(() => ({
      isProjectModalOpen: false,
    })),

  showSuccessToast: (message: string) =>
    set(() => ({
      toast: { message, type: "success" },
    })),

  showErrorToast: (message: string) =>
    set(() => ({
      toast: { message, type: "error" },
    })),

  clearToast: () =>
    set(() => ({
      toast: null,
    })),

  setBackendSecret: (secret: string) =>
    set(() => ({
      backendSecret: secret,
    })),

  setCurrentProject: (projectId: string | null) =>
    set(() => ({
      currentProjectId: projectId,
    })),
}));

export const useAppSelector = useAppStore;

export function getBackendPort(): number | null {
  return useAppStore.getState().backendPort;
}

export function getAuthStatus(): AuthStatus {
  return useAppStore.getState().authStatus;
}

export function getCurrentProjectId(): string | null {
  return useAppStore.getState().currentProjectId;
}

export function getBackendSecret(): string {
  return useAppStore.getState().backendSecret;
}
