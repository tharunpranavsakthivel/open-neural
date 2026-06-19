/**
 * Electron preload bridge for renderer-safe OpenNeural APIs.
 *
 * The initial Task 1 shell exposes a versioned namespace only. Later tasks add
 * narrow IPC methods here without enabling Node.js access in the renderer.
 */
import { contextBridge } from "electron";

export interface OpenNeuralElectronApi {
  readonly shellVersion: string;
}

const electronApi: OpenNeuralElectronApi = {
  shellVersion: "0.1.0"
};

contextBridge.exposeInMainWorld("electronAPI", electronApi);
