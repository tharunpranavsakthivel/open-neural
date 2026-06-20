/**
 * Export screen - Step 7: Model and artifact export.
 *
 * Allows users to export trained models, pipelines, reports, and predictions.
 *
 * @module screens/Export
 */
interface ExportProps {
  /** Currently selected project ID */
  projectId: string;
}

/**
 * Export wizard step component.
 *
 * @param props - Component props
 * @returns The export screen
 */
export function Export({ projectId: _projectId }: ExportProps): JSX.Element {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Export</h1>
        <p style={styles.description}>
          Export trained models, pipelines, and evaluation artifacts.
        </p>
      </header>

      <div style={styles.exportGrid}>
        <div style={styles.exportCard}>
          <div style={styles.exportIcon}>🧠</div>
          <h3 style={styles.exportTitle}>Model</h3>
          <p style={styles.exportDescription}>
            Export trained model in ONNX and joblib formats
          </p>
          <button style={styles.exportButton}>Export Model</button>
        </div>

        <div style={styles.exportCard}>
          <div style={styles.exportIcon}>⚙️</div>
          <h3 style={styles.exportTitle}>Pipeline</h3>
          <p style={styles.exportDescription}>
            Export fitted preprocessing pipeline
          </p>
          <button style={styles.exportButton}>Export Pipeline</button>
        </div>

        <div style={styles.exportCard}>
          <div style={styles.exportIcon}>📊</div>
          <h3 style={styles.exportTitle}>Report</h3>
          <p style={styles.exportDescription}>
            Export evaluation report as PDF
          </p>
          <button style={styles.exportButton}>Export Report</button>
        </div>

        <div style={styles.exportCard}>
          <div style={styles.exportIcon}>📄</div>
          <h3 style={styles.exportTitle}>Predictions</h3>
          <p style={styles.exportDescription}>
            Export test set predictions as CSV
          </p>
          <button style={styles.exportButton}>Export Predictions</button>
        </div>
      </div>

      <div style={styles.destinationCard}>
        <h2 style={styles.cardTitle}>Export Destination</h2>
        <div style={styles.destinationInput}>
          <input
            type="text"
            readOnly
            placeholder="Select destination directory..."
            style={styles.input}
          />
          <button
            onClick={async () => {
              const result = await window.electronAPI.openDirectoryDialog({
                title: "Select Export Destination",
              });
              if (result) {
                console.log("Selected directory:", result);
              }
            }}
            style={styles.browseButton}
          >
            Browse
          </button>
        </div>
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
  exportGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "1rem",
    marginBottom: "2rem",
  },
  exportCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.5rem",
    textAlign: "center",
  },
  exportIcon: {
    fontSize: "2rem",
    marginBottom: "0.75rem",
  },
  exportTitle: {
    margin: "0 0 0.5rem 0",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  exportDescription: {
    margin: "0 0 1rem 0",
    fontSize: "0.75rem",
    color: "#6b7280",
    lineHeight: 1.4,
  },
  exportButton: {
    padding: "0.5rem 1rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  destinationCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.5rem",
  },
  cardTitle: {
    margin: "0 0 1rem 0",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  destinationInput: {
    display: "flex",
    gap: "0.5rem",
  },
  input: {
    flex: 1,
    padding: "0.5rem 0.75rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
  },
  browseButton: {
    padding: "0.5rem 1rem",
    backgroundColor: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    cursor: "pointer",
  },
};
