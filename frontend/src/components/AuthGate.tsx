/**
 * AuthGate component - authentication gate for the OpenNeural application.
 *
 * Renders the appropriate screen based on authentication state:
 * - PasswordSetup: First launch, no password set
 * - LoginScreen: Password exists, user needs to authenticate
 * - AppShell: User is authenticated, show main application
 *
 * @module components/AuthGate
 */
import { useEffect } from "react";
import { useAppStore } from "../stores/appStore";
import { PasswordSetup } from "../screens/PasswordSetup";
import { LoginScreen } from "../screens/LoginScreen";
import { AppShell } from "./AppShell";
import { Toast } from "./Toast";

/**
 * AuthGate component that conditionally renders screens based on auth state.
 *
 * On mount, checks the authentication state via Electron API and determines
 * whether to show password setup, login, or the main application shell.
 *
 * @returns The appropriate screen component based on auth status
 */
export function AuthGate(): JSX.Element {
  const {
    authStatus,
    error,
    setAuthStatus,
    setAuthState,
    setError,
    setAuthenticated,
  } = useAppStore();

  useEffect(() => {
    // Check authentication state on mount
    async function checkAuth() {
      try {
        const state = await window.electronAPI.checkAuthState();
        setAuthState(state);

        if (state.isFirstLaunch) {
          setAuthStatus("setup");
        } else {
          setAuthStatus("login");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to check authentication state");
        setAuthStatus("login");
      }
    }

    if (authStatus === "loading") {
      checkAuth();
    }
  }, [authStatus, setAuthStatus, setAuthState, setError]);

  // Show loading state while checking auth
  if (authStatus === "loading") {
    return (
      <div role="status" aria-live="polite" style={styles.loading}>
        <p>Initializing OpenNeural...</p>
      </div>
    );
  }

  // Show error state
  if (error && authStatus !== "authenticated") {
    return (
      <div role="alert" style={styles.error}>
        <h2>Initialization Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  // Render based on auth status
  let content: JSX.Element;
  switch (authStatus) {
    case "setup":
      content = <PasswordSetup onComplete={() => setAuthStatus("login")} />;
      break;
    case "login":
      content = <LoginScreen onLogin={setAuthenticated} />;
      break;
    case "authenticated":
      content = <AppShell />;
      break;
    default:
      // Fallback to loading for any unexpected state
      content = (
        <div role="status" style={styles.loading}>
          <p>Initializing OpenNeural...</p>
        </div>
      );
  }

  return (
    <>
      {content}
      <Toast />
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  error: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#dc2626",
  },
};
