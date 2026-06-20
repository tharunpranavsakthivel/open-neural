/**
 * PreprocessingPipeline screen - Step 2: Visual preprocessing pipeline builder.
 *
 * Allows users to build a preprocessing pipeline by arranging visual blocks.
 *
 * @module screens/PreprocessingPipeline
 */
interface PreprocessingPipelineProps {
  /** Currently selected project ID */
  projectId: string;
}

/**
 * Preprocessing pipeline wizard step component.
 *
 * @param props - Component props
 * @returns The preprocessing pipeline screen
 */
export function PreprocessingPipeline({
  projectId: _projectId,
}: PreprocessingPipelineProps): JSX.Element {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Preprocessing Pipeline</h1>
        <p style={styles.description}>
          Build a preprocessing pipeline by arranging and configuring blocks.
        </p>
      </header>

      <div style={styles.content}>
        <div style={styles.blocksPanel}>
          <h2 style={styles.panelTitle}>Available Blocks</h2>
          <ul style={styles.blockList}>
            <li style={styles.blockItem}>Drop Nulls</li>
            <li style={styles.blockItem}>Fill Missing (Mean)</li>
            <li style={styles.blockItem}>Fill Missing (Median)</li>
            <li style={styles.blockItem}>Encode Categoricals (One-Hot)</li>
            <li style={styles.blockItem}>Encode Categoricals (Ordinal)</li>
            <li style={styles.blockItem}>Scale Numerics (Standard)</li>
            <li style={styles.blockItem}>Scale Numerics (Min-Max)</li>
            <li style={styles.blockItem}>Log Transform</li>
            <li style={styles.blockItem}>Remove Outliers (IQR)</li>
            <li style={styles.blockItem}>Feature Selection</li>
            <li style={styles.blockItem}>Train/Val/Test Split</li>
          </ul>
        </div>

        <div style={styles.pipelinePanel}>
          <h2 style={styles.panelTitle}>Pipeline</h2>
          <div style={styles.pipelineDropZone}>
            <p style={styles.placeholder}>
              Drag blocks here to build your pipeline
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "1000px",
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
  content: {
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    gap: "1.5rem",
  },
  blocksPanel: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.5rem",
  },
  panelTitle: {
    margin: "0 0 1rem 0",
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  blockList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  blockItem: {
    padding: "0.75rem",
    backgroundColor: "#f3f4f6",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "0.875rem",
    color: "#374151",
    cursor: "grab",
  },
  pipelinePanel: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.5rem",
    minHeight: "400px",
  },
  pipelineDropZone: {
    border: "2px dashed #e5e7eb",
    borderRadius: "8px",
    padding: "3rem",
    textAlign: "center",
    minHeight: "300px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    margin: 0,
    color: "#9ca3af",
    fontSize: "0.875rem",
  },
};
