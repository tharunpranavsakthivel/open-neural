/**
 * Top-level React component for the OpenNeural application.
 *
 * On mount, calls `window.electronAPI.getBackendPort()` to retrieve the backend
 * port from the Electron main process and stores it in the Zustand appStore.
 * Renders the `<AuthGate />` component which conditionally renders either
 * the `<PasswordSetup />` screen, the `<LoginScreen />`, or the main `<AppShell />`
 * based on the current authentication state.
 *
 * After successful authentication, checks for interrupted experiments
 * via `GET /api/v1/experiments/interrupted` and displays a recovery banner
 * if any interrupted experiments are found.
 *
 * @module App
 */
import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "./stores/appStore";
import { AuthGate } from "./components/AuthGate";
import { AppShell } from "./components/AppShell";
import {
  CrashRecoveryBanner,
  type InterruptedExperiment,
} from "./components/CrashRecoveryBanner";
import { fetchInterruptedExperiments } from "./utils/api";

/**
 * Root application component.
 *
 * Fetches the backend port on mount and renders the authentication gate
 * to determine which screen to display based on auth state.
 * After authentication, checks for interrupted experiments and displays
 * recovery options if found.
 *
 * @returns The root application component
 */
export function App(): JSX.Element {
  const {
    authStatus,
    setBackendPort,
    setIsLoadingPort,
    setCurrentStep,
    setCurrentProjectId,
    setCurrentExperimentId,
  } = useAppStore();

  /**
   * State for interrupted experiments.
   */
  const [interruptedExperiments, setInterruptedExperiments] = useState<
    InterruptedExperiment[]
  >([]);

  /**
   * State for checking interrupted experiments.
   */
  const [isCheckingInterrupted, setIsCheckingInterrupted] = useState(false);

  /**
   * Fetch backend port on mount.
   */
  useEffect(() => {
    /**
     * Fetch the backend port from the Electron main process.
     * The port is used for all subsequent API calls to the Python backend.
     */
    async function fetchBackendPort() {
      try {
        const port = await window.electronAPI.getBackendPort();
        if (port !== null) {
          setBackendPort(port);
        }
      } catch (error) {
        // Port fetch failure is logged but auth flow continues
        // The app will retry or show appropriate error in AuthGate
        console.error("Failed to fetch backend port:", error);
      } finally {
        setIsLoadingPort(false);
      }
    }

    fetchBackendPort();
  }, [setBackendPort, setIsLoadingPort]);

  /**
   * Check for interrupted experiments after authentication.
   */
  useEffect(() => {
    /**
     * Check for interrupted experiments.
     *
     * Called after successful authentication to detect any experiments
     * that were interrupted due to app crash or unexpected shutdown.
     */
    async function checkInterrupted() {
      if (authStatus !== "authenticated") {
        return;
      }

      try {
        setIsCheckingInterrupted(true);
        const experiments = await fetchInterruptedExperiments();
        setInterruptedExperiments(experiments);
      } catch (error) {
        console.error("Failed to check for interrupted experiments:", error);
        // Non-critical error - don't block app usage
      } finally {
        setIsCheckingInterrupted(false);
      }
    }

    checkInterrupted();
  }, [authStatus]);

  /**
   * Handle restart action - navigate to training step with the experiment.
   */
  const handleRestart = useCallback(
    (experimentId: string, projectId: string) => {
      // Set up the navigation state
      setCurrentProjectId(projectId);
      setCurrentExperimentId(experimentId);
      setCurrentStep("training");

      // Remove from the list
      setInterruptedExperiments((prev) =>
        prev.filter((e) => e.id !== experimentId),
      );
    },
    [setCurrentProjectId, setCurrentExperimentId, setCurrentStep],
  );

  /**
   * Handle discard action - remove from the list.
   */
  const handleDiscard = useCallback((experimentId: string) => {
    setInterruptedExperiments((prev) =>
      prev.filter((e) => e.id !== experimentId),
    );
  }, []);

  /**
   * Handle dismiss action - clear all interrupted experiments.
   */
  const handleDismiss = useCallback(() => {
    setInterruptedExperiments([]);
  }, []);

  // Show AuthGate while not authenticated
  if (authStatus !== "authenticated") {
    return <AuthGate />;
  }

  return (
    <div style={styles.container}>
      {/* Crash Recovery Banner */}
      {interruptedExperiments.length > 0 && (
        <div style={styles.bannerContainer}>
          <CrashRecoveryBanner
            interruptedExperiments={interruptedExperiments}
            onRestart={handleRestart}
            onDiscard={handleDiscard}
            onDismiss={handleDismiss}
          />
        </div>
      )}

      {/* Main App Shell */}
      <AppShell />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
  },
  bannerContainer: {
    flexShrink: 0,
    padding: "1rem 1rem 0 1rem",
    backgroundColor: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
  },
};
