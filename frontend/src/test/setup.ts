import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock window.electronAPI
const mockElectronAPI = {
  shellVersion: "1.0.0",
  checkAuthState: vi.fn().mockResolvedValue({
    isFirstLaunch: false,
    dataDir: "/test/data",
    dbPath: "/test/data/db.sqlite",
  }),
  validatePassword: vi.fn().mockResolvedValue({ success: true }),
  validateSetupPassword: vi.fn().mockResolvedValue({ success: true }),
  storePassword: vi.fn().mockResolvedValue({ success: true }),
  changePassword: vi.fn().mockResolvedValue({ success: true }),
  getBackendPort: vi.fn().mockResolvedValue(8000),
  openFileDialog: vi.fn().mockResolvedValue("/test/file.csv"),
  openDirectoryDialog: vi.fn().mockResolvedValue("/test/export_dir"),
  openPath: vi.fn().mockResolvedValue(undefined),
  checkInterruptedExperiments: vi.fn().mockResolvedValue({
    success: true,
    interruptedExperiments: [],
  }),
};

Object.defineProperty(window, "electronAPI", {
  value: mockElectronAPI,
  writable: true,
});
