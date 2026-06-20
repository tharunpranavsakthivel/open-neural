/**
 * DatasetImport screen - Step 1: Dataset upload and versioning.
 *
 * Allows users to upload CSV or Parquet files to create a versioned dataset
 * snapshot. Displays file drop zone, file browser dialog, and upload progress.
 *
 * @module screens/DatasetImport
 */

import { useState, useCallback } from "react";
import { uploadDatasetSnapshot, type DatasetSnapshotResponse } from "../utils/api";
import { SchemaTable } from "../components/SchemaTable";
import { DatasetSummary } from "../components/DatasetSummary";

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
  projectId,
  onComplete,
}: DatasetImportProps): JSX.Element {
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [snapshot, setSnapshot] = useState<DatasetSnapshotResponse | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle file upload with progress tracking.
   */
  const handleFileUpload = useCallback(
    async (file: File) => {
      setError(null);
      setUploadProgress(0);
      setIsUploading(true);
      setIsAnalyzing(false);

      try {
        // Upload file with progress tracking
        const response = await uploadDatasetSnapshot(
          projectId,
          file,
          (progress) => {
            setUploadProgress(progress);
            if (progress === 100) {
              setIsUploading(false);
              setIsAnalyzing(true);
            }
          }
        );

        setSnapshot(response);
        setImportedFile(file);
        setIsAnalyzing(false);
        onComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setIsUploading(false);
        setIsAnalyzing(false);
      }
    },
    [projectId, onComplete]
  );

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

      // Start upload process
      await handleFileUpload(file);
    },
    [handleFileUpload]
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
        // Create a File object from the selected path
        // Note: In Electron, we need to read the file via the main process
        // For now, we create a placeholder that will be replaced when uploaded
        const fileName = result.split("/").pop() || result.split("\\").pop() || "unknown";
        const file = new File([], fileName, {
          type: fileName.endsWith(".parquet")
            ? "application/vnd.apache.parquet"
            : "text/csv",
        });
        // Store the actual path for later use
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (file as any).path = result;
        await handleFileSelect(file);
      }
    } catch (err) {
      setError("Failed to open file dialog. Please try again.");
      console.error("File dialog error:", err);
    }
  }, [handleFileSelect]);

  /**
   * Render upload progress indicator.
   */
  const renderUploadProgress = (): JSX.Element | null => {
    if (!isUploading && !isAnalyzing) {
      return null;
    }

    return (
      <div style={styles.progressOverlay}>
        <div style={styles.progressContainer}>
          {isUploading && (
            <>
              <div style={styles.progressBarContainer}>
                <div
                  style={{
                    ...styles.progressBarFill,
                    width: `${uploadProgress}%`,
                  }}
                />
              </div>
              <p style={styles.progressText}>
                Uploading... {uploadProgress}%
              </p>
            </>
          )}
          {isAnalyzing && (
            <div style={styles.analyzingContainer}>
              <div style={styles.spinner} />
              <p style={styles.analyzingText}>Analyzing dataset...</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Dataset Import</h1>
        <p style={styles.description}>
          Upload a CSV or Parquet file to create a versioned dataset snapshot.
        </p>
      </header>

      {/* Warning banner when no file is imported */}
      {!importedFile && !isUploading && !isAnalyzing && (
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
          ...(isUploading || isAnalyzing ? styles.dropZoneDisabled : {}),
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
            disabled={isUploading || isAnalyzing}
          >
            Browse Files
          </button>
        </div>

        {/* Upload progress overlay */}
        {renderUploadProgress()}
      </div>

      {/* Imported file info */}
      {snapshot && importedFile && (
        <div style={styles.successBanner}>
          <span style={styles.successIcon}>✅</span>
          <div>
            <strong>File imported:</strong> {snapshot.file_name}
            <br />
            <small>
              Version: {snapshot.version_label} • {snapshot.row_count.toLocaleString()} rows • {snapshot.col_count} columns
            </small>
            <br />
            <small style={styles.checksumText}>
              SHA-256: {snapshot.checksum_sha256.slice(0, 16)}...
            </small>
          </div>
        </div>
      )}

      {/* Dataset Summary Cards */}
      {snapshot && <DatasetSummary snapshot={snapshot} />}

      {/* Schema Table */}
      {snapshot && <SchemaTable schema={snapshot.schema} />}

      {/* Memory Warning Banner */}
      {snapshot?.memory_warning && (
        <div style={styles.memoryWarningBanner} role="alert">
          <div style={styles.memoryWarningHeader}>
            <span style={styles.memoryWarningIcon}>⚠️</span>
            <span style={styles.memoryWarningTitle}>Memory Advisory</span>
          </div>
          <p style={styles.memoryWarningMessage}>
            {snapshot.memory_warning_message ?? "This dataset may consume significant memory during training. Consider dataset sampling for large datasets."}
          </p>
          <a
            href="#"
            style={styles.memoryWarningLink}
            onClick={(e) => {
              e.preventDefault();
              // TODO: Link to Dataset Sampling documentation (Phase 2)
              console.log("Dataset Sampling documentation link clicked");
            }}
          >
            Learn about Dataset Sampling →
          </a>
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
    alignItems: "flex-start",
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
    marginTop: "0.125rem",
  },
  checksumText: {
    fontSize: "0.75rem",
    color: "#6b7280",
    fontFamily: "monospace",
  },
  dropZone: {
    position: "relative",
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
  dropZoneDisabled: {
    opacity: 0.7,
    pointerEvents: "none" as const,
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
  progressOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
  },
  progressContainer: {
    textAlign: "center",
    padding: "2rem",
  },
  progressBarContainer: {
    width: "280px",
    height: "8px",
    backgroundColor: "#e5e7eb",
    borderRadius: "4px",
    overflow: "hidden",
    marginBottom: "1rem",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#2563eb",
    transition: "width 0.15s ease",
    borderRadius: "4px",
  },
  progressText: {
    margin: 0,
    fontSize: "0.875rem",
    color: "#374151",
    fontWeight: 500,
  },
  analyzingContainer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "1rem",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #e5e7eb",
    borderTopColor: "#2563eb",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  analyzingText: {
    margin: 0,
    fontSize: "1rem",
    color: "#374151",
    fontWeight: 500,
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
  memoryWarningBanner: {
    marginTop: "1.5rem",
    padding: "1rem",
    backgroundColor: "#fefce8", // yellow-50
    border: "1px solid #facc15", // yellow-400
    borderRadius: "8px",
    borderLeftWidth: "4px",
    borderLeftColor: "#eab308", // yellow-500
  },
  memoryWarningHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "0.5rem",
  },
  memoryWarningIcon: {
    fontSize: "1.25rem",
  },
  memoryWarningTitle: {
    fontWeight: 600,
    color: "#854d0e", // yellow-800
    fontSize: "0.875rem",
  },
  memoryWarningMessage: {
    margin: "0 0 0.75rem 0",
    fontSize: "0.875rem",
    color: "#a16207", // yellow-700
    lineHeight: 1.5,
  },
  memoryWarningLink: {
    display: "inline-block",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#2563eb", // blue-600
    textDecoration: "none",
    cursor: "pointer",
    transition: "color 0.15s ease",
  },
};
