/**
 * DatasetImport screen - Step 1: Dataset upload and versioning.
 *
 * Allows users to upload CSV or Parquet files to create a versioned dataset
 * snapshot. Displays file drop zone and file browser dialog.
 *
 * @module screens/DatasetImport
 */
interface DatasetImportProps {
  /** Currently selected project ID */
  projectId: string;
  /** Callback when dataset is successfully imported */
  onComplete: () => void;
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
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Dataset Import</h1>
        <p style={styles.description}>
          Upload a CSV or Parquet file to create a versioned dataset snapshot.
        </p>
      </header>

      <div
        style={styles.dropZone}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          // Handle file drop - implementation in future task
          console.log("Files dropped:", e.dataTransfer.files);
        }}
        role="region"
        aria-label="File drop zone"
      >
        <div style={styles.dropZoneContent}>
          <div style={styles.uploadIcon}>📁</div>
          <p style={styles.dropZoneText}>
            Drag and drop a CSV or Parquet file here
          </p>
          <p style={styles.dropZoneSubtext}>
            or click the button below to browse
          </p>
          <button
            onClick={async () => {
              const result = await window.electronAPI.openFileDialog({
                title: "Select Dataset File",
              });
              if (result) {
                console.log("Selected file:", result);
                // Handle file selection - implementation in future task
              }
            }}
            style={styles.browseButton}
          >
            Browse Files
          </button>
        </div>
      </div>

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
    marginBottom: "2rem",
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
  dropZone: {
    border: "2px dashed #d1d5db",
    borderRadius: "8px",
    padding: "3rem",
    backgroundColor: "#f9fafb",
    transition: "border-color 0.15s ease, background-color 0.15s ease",
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
