/**
 * Training screen - Step 4: Model training and experiment tracking.
 *
 * Displays training progress, live metrics, and experiment status.
 *
 * @module screens/Training
 */
interface TrainingProps {
  /** Currently selected project ID */
  projectId: string;
}

/**
 * Training wizard step component.
 *
 * @param props - Component props
 * @returns The training screen
 */
export function Training({
  projectId: _projectId,
}: TrainingProps): JSX.Element {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Training</h1>
        <p style={styles.description}>
          Train models and track experiment progress.
        </p>
      </header>

      <div style={styles.statusCard}>
        <div style={styles.statusHeader}>
          <h2 style={styles.statusTitle}>Experiment Status</h2>
          <span style={styles.statusBadge}>Ready</span>
        </div>
        <p style={styles.statusText}>
          Configure your pipeline and models, then start training to run
          experiments.
        </p>
        <button style={styles.startButton}>Start Training</button>
      </div>

      <div style={styles.metricsCard}>
        <h2 style={styles.cardTitle}>Live Metrics</h2>
        <div style={styles.metricsPlaceholder}>
          <p>Training metrics will appear here once training begins.</p>
          <div style={styles.mockMetrics}>
            <div style={styles.metric}>
              <span style={styles.metricLabel}>CPU Usage</span>
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: "0%" }} />
              </div>
              <span style={styles.metricValue}>0%</span>
            </div>
            <div style={styles.metric}>
              <span style={styles.metricLabel}>RAM Usage</span>
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: "0%" }} />
              </div>
              <span style={styles.metricValue}>0 GB</span>
            </div>
          </div>
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
  statusCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.5rem",
    marginBottom: "1.5rem",
  },
  statusHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  statusTitle: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  statusBadge: {
    padding: "0.25rem 0.75rem",
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
    borderRadius: "9999px",
    fontSize: "0.75rem",
    fontWeight: 500,
  },
  statusText: {
    margin: "0 0 1rem 0",
    color: "#6b7280",
    fontSize: "0.875rem",
  },
  startButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  metricsCard: {
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
  metricsPlaceholder: {
    padding: "2rem",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
    textAlign: "center",
    color: "#6b7280",
    fontSize: "0.875rem",
  },
  mockMetrics: {
    marginTop: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  metric: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  metricLabel: {
    width: "80px",
    fontSize: "0.75rem",
    color: "#374151",
    textAlign: "right",
  },
  progressBar: {
    flex: 1,
    height: "8px",
    backgroundColor: "#e5e7eb",
    borderRadius: "4px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2563eb",
    borderRadius: "4px",
    transition: "width 0.3s ease",
  },
  metricValue: {
    width: "60px",
    fontSize: "0.75rem",
    color: "#374151",
    textAlign: "left",
  },
};
