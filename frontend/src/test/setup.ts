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
  getBackendSecret: vi.fn().mockResolvedValue("test_secret_for_ipc_auth_42"),
  openFileDialog: vi.fn().mockResolvedValue("/test/file.csv"),
  openDirectoryDialog: vi.fn().mockResolvedValue("/test/export_dir"),
  uploadDataset: vi.fn().mockResolvedValue({
    id: "snapshot-123",
    version_label: "Snapshot v1",
    file_name: "file.csv",
    file_size_bytes: 1000,
    row_count: 10,
    col_count: 5,
    schema: [],
    checksum_sha256: "abc123checksum",
    created_at: new Date().toISOString(),
  }),
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
