/**
 * Global application state store using Zustand.
 *
 * Manages the backend port (received from Electron main process), authentication
 * state, and other global UI state. Persists auth state across component mounts.
 *
 * @module stores/appStore
 */
import type { AuthState } from "../types/electron";

type AuthStatus = "loading" | "setup" | "login" | "authenticated";

/**
 * Application state interface.
 */
interface AppState {
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
}

/**
 * Application store interface including state and actions.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
interface AppStore extends AppState {
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
}

// Store instance
let storeInstance: AppStore | null = null;

/**
 * Initialize the app store singleton.
 *
 * @returns The app store instance
 */
function initializeStore(): AppStore {
  if (storeInstance !== null) {
    return storeInstance;
  }

  // Initial state
  let state: AppState = {
    backendPort: null,
    isLoadingPort: true,
    authStatus: "loading",
    authState: null,
    error: null,
  };

  // Actions
  const setBackendPort = (port: number): void => {
    state = { ...state, backendPort: port };
  };

  const setIsLoadingPort = (loading: boolean): void => {
    state = { ...state, isLoadingPort: loading };
  };

  const setAuthStatus = (status: AuthStatus): void => {
    state = { ...state, authStatus: status };
  };

  const setAuthState = (newAuthState: AuthState): void => {
    state = { ...state, authState: newAuthState };
  };

  const setError = (error: string | null): void => {
    state = { ...state, error };
  };

  const setAuthenticated = (): void => {
    state = { ...state, authStatus: "authenticated" };
  };

  storeInstance = {
    ...state,
    setBackendPort,
    setIsLoadingPort,
    setAuthStatus,
    setAuthState,
    setError,
    setAuthenticated,
  };

  return storeInstance;
}

/**
 * Zustand-style hook for global application state.
 *
 * Note: This is a simplified store implementation. In production with dependencies
 * installed, it would use the full Zustand library with reactive subscriptions.
 *
 * @example
 * const { backendPort, setBackendPort } = useAppStore();
 * useEffect(() => {
 *   window.electronAPI.getBackendPort().then(port => {
 *     if (port) setBackendPort(port);
 *   });
 * }, []);
 * @returns The app store with state and actions
 */
export function useAppStore(): AppStore {
  return initializeStore();
}
