/**
 * Top-level React component for the OpenNeural application.
 *
 * On mount, calls `window.electronAPI.getBackendPort()` to retrieve the backend
 * port from the Electron main process and stores it in the Zustand appStore.
 * Renders the `<AuthGate />` component which conditionally renders either
 * the `<PasswordSetup />` screen, the `<LoginScreen />`, or the main `<AppShell />`
 * based on the current authentication state.
 *
 * @module App
 */
import { useEffect } from "react";
import { useAppStore } from "./stores/appStore";
import { AuthGate } from "./components/AuthGate";

/**
 * Root application component.
 *
 * Fetches the backend port on mount and renders the authentication gate
 * to determine which screen to display based on auth state.
 *
 * @returns The root application component
 */
export function App(): JSX.Element {
  const { setBackendPort, setIsLoadingPort } = useAppStore();

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

  return <AuthGate />;
}
