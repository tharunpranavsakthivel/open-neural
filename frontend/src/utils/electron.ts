/**
 * Electron preload API access helpers.
 *
 * The renderer requires the Electron preload bridge for authentication,
 * backend-port discovery, and native file dialogs. This module centralizes the
 * runtime guard so startup failures explain the missing bridge clearly.
 *
 * @module utils/electron
 */
import type { OpenNeuralElectronApi } from "../types/electron";

/**
 * Returns the Electron preload API exposed by the desktop shell.
 *
 * @returns The typed Electron API exposed on window.electronAPI
 * @throws Error when the renderer is not running inside the Electron shell or
 * the preload script failed before exposing the bridge.
 */
export function getElectronApi(): OpenNeuralElectronApi {
  const electronApi = window.electronAPI;

  if (electronApi === undefined) {
    throw new Error(
      "Electron preload API is unavailable. Start OpenNeural with `npm run dev` from the project root and close any stale Electron windows before retrying.",
    );
  }

  return electronApi;
}
