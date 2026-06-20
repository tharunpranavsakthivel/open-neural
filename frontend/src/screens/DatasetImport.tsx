/**
 * DatasetImport screen - Step 1: Dataset upload and versioning.
 *
 * Allows users to upload CSV or Parquet files to create a versioned dataset
 * snapshot. Displays file drop zone and file browser dialog.
 *
 * @module screens/DatasetImport
 */

import { useState, useCallback } from "react";

interface DatasetImportProps {
  /** Currently selected project ID */
  projectId: string;
  /** Callback when dataset is successfully imported */
  onComplete: () => void;
}

/**
 * Valid MIME types for dataset files.
 */
const VALID_MIME_TYPES = [
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.apache.parquet",
  "application/x-parquet",
  "application/octet-stream",
];

/**
 * Valid file extensions for dataset files.
 */
const VALID_EXTENSIONS = [".csv", ".parquet"];

/**
 * Checks if a file has a valid MIME type or extension for dataset import.
 *
 * @param file - The file to validate
 * @returns True if the file type is valid
 */
function isValidFileType(file: File): boolean {
  // Check MIME type first
  if (VALID_MIME_TYPES.includes(file.type)) {
    return true;
  }

  // Fall back to extension check for files without proper MIME type detection
  const fileName = file.name.toLowerCase();
  return VALID_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

/**
 * Dataset import wizard step component.
 *
 * @param props - Component props
 * @returns The dataset import screen
 */
export function DatasetImport({
  projectId: _projectId,
  onComplete: _onComplete,
}: DatasetImportProps): JSX.Element {
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle file selection from dialog or drop.
   */
  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);

      if (!isValidFileType(file)) {
        setError(
          "Invalid file type. Please upload a CSV or Parquet file."
        );
        return;
      }

      // Validate file size (2 GB limit per SRS FR-DATA-02)
      const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB in bytes
      if (file.size > MAX_FILE_SIZE) {
        setError(
          `File size exceeds 2 GB limit. Current size: ${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
        );
        return;
      }

      setImportedFile(file);

      // TODO: Upload file to backend in future task
      console.log("File selected:", file.name, "Size:", file.size);

      // TODO: Call onComplete() after successful upload
    },
    []
  );

  /**
   * Handle drag over event to enable drop.
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  /**
   * Handle drag leave event.
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  /**
   * Handle file drop event.
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length === 0) {
        return;
      }

      if (files.length > 1) {
        setError("Please upload only one file at a time.");
        return;
      }

      const file = files[0];
      if (file) {
        void handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  /**
   * Handle browse button click to open file dialog.
   */
  const handleBrowseClick = useCallback(async () => {
    try {
      const result = await window.electronAPI.openFileDialog({
        title: "Select Dataset File",
      });

      if (result && typeof result === "string") {
        // Create a File-like object from the path
        // In a real implementation, this would be handled by the backend
        // For now, we just store the path and create a placeholder File object
        const fileName = result.split("/").pop() || result.split("\\").pop() || "unknown";
        const file = new File([], fileName, {
          type: fileName.endsWith(".parquet")
            ? "application/vnd.apache.parquet"
            : "text/csv",
        });
        await handleFileSelect(file);
      }
    } catch (err) {
      setError("Failed to open file dialog. Please try again.");
      console.error("File dialog error:", err);
    }
  }, [handleFileSelect]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Dataset Import</h1>
        <p style={styles.description}>
          Upload a CSV or Parquet file to create a versioned dataset snapshot.
        </p>
      </header>

      {/* Warning banner when no file is imported */}
      {!importedFile && (
        <div style={styles.warningBanner} role="alert">
          <span style={styles.warningIcon}>⚠️</span>
          <span>
            No dataset imported yet. Please upload a file to proceed.
          </span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={styles.errorBanner} role="alert">
          <span style={styles.errorIcon}>❌</span>
          <span>{error}</span>
        </div>
      )}

      {/* File drop zone */}
      <div
        style={{
          ...styles.dropZone,
          ...(isDragging ? styles.dropZoneActive : {}),
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="region"
        aria-label="File drop zone"
      >
        <div style={styles.dropZoneContent}>
          <div style={styles.uploadIcon}>📁</div>
          <p style={styles.dropZoneText}>
            Drag and drop a CSV or Parquet file here
          </p>
          <p style={styles.dropZoneSubtext}>
            Accepted formats: .csv, .parquet (max 2 GB)
          </p>
          <button
            onClick={handleBrowseClick}
            style={styles.browseButton}
            type="button"
          >
            Browse Files
          </button>
        </div>
      </div>

      {/* Imported file info */}
      {importedFile && (
        <div style={styles.successBanner}>
          <span style={styles.successIcon}>✅</span>
          <div>
            <strong>File selected:</strong> {importedFile.name}
            <br />
            <small>
              Size: {(importedFile.size / (1024 * 1024)).toFixed(2)} MB
            </small>
          </div>
        </div>
      )}

      <div style={styles.infoBox}>
        <h3 style={styles.infoTitle}>Supported Formats</h3>
        <ul style={styles.infoList}>
          <li>CSV files (.csv)</li>
          <li>Parquet files (.parquet)</li>
        </ul>
        <p style={styles.infoNote}>
          Maximum file size: 2 GB. Files are stored as immutable snapshots for
          reproducibility.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "2rem",
  },
  header: {
    marginBottom: "1.5rem",
  },
  title: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#111827",
  },
  description: {
    margin: 0,
    color: "#6b7280",
    fontSize: "0.875rem",
  },
  warningBanner: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "1rem",
    backgroundColor: "#fffbeb",
    border: "1px solid #f59e0b",
    borderRadius: "8px",
    marginBottom: "1.5rem",
    color: "#92400e",
    fontSize: "0.875rem",
  },
  warningIcon: {
    fontSize: "1rem",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "1rem",
    backgroundColor: "#fef2f2",
    border: "1px solid #ef4444",
    borderRadius: "8px",
    marginBottom: "1.5rem",
    color: "#991b1b",
    fontSize: "0.875rem",
  },
  errorIcon: {
    fontSize: "1rem",
  },
  successBanner: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "1rem",
    backgroundColor: "#f0fdf4",
    border: "1px solid #22c55e",
    borderRadius: "8px",
    marginTop: "1.5rem",
    color: "#166534",
    fontSize: "0.875rem",
  },
  successIcon: {
    fontSize: "1.25rem",
  },
  dropZone: {
    border: "2px dashed #d1d5db",
    borderRadius: "8px",
    padding: "3rem",
    backgroundColor: "#f9fafb",
    transition: "border-color 0.15s ease, background-color 0.15s ease",
  },
  dropZoneActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  dropZoneContent: {
    textAlign: "center",
  },
  uploadIcon: {
    fontSize: "3rem",
    marginBottom: "1rem",
  },
  dropZoneText: {
    margin: "0 0 0.5rem 0",
    fontSize: "1rem",
    color: "#374151",
  },
  dropZoneSubtext: {
    margin: "0 0 1.5rem 0",
    fontSize: "0.875rem",
    color: "#6b7280",
  },
  browseButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  infoBox: {
    marginTop: "2rem",
    padding: "1.5rem",
    backgroundColor: "#eff6ff",
    borderRadius: "8px",
    border: "1px solid #dbeafe",
  },
  infoTitle: {
    margin: "0 0 0.75rem 0",
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#1e40af",
  },
  infoList: {
    margin: "0 0 1rem 0",
    paddingLeft: "1.25rem",
    color: "#374151",
    fontSize: "0.875rem",
  },
  infoNote: {
    margin: 0,
    fontSize: "0.75rem",
    color: "#6b7280",
    fontStyle: "italic",
  },
};
