/**
 * Evaluation screen - Step 5: Evaluation dashboard and metrics.
 *
 * Displays model evaluation metrics, confusion matrix, and subgroup analysis.
 *
 * @module screens/Evaluation
 */
interface EvaluationProps {
  /** Currently selected project ID */
  projectId: string;
}

/**
 * Evaluation wizard step component.
 *
 * @param props - Component props
 * @returns The evaluation screen
 */
export function Evaluation({ projectId: _projectId }: EvaluationProps): JSX.Element {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Evaluation</h1>
        <p style={styles.description}>
          Review model performance metrics and analysis.
        </p>
      </header>

      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>F1 Score</span>
          <span style={styles.metricValue}>—</span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>AUC-ROC</span>
          <span style={styles.metricValue}>—</span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Precision</span>
          <span style={styles.metricValue}>—</span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Recall</span>
          <span style={styles.metricValue}>—</span>
        </div>
      </div>

      <div style={styles.contentGrid}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Confusion Matrix</h2>
          <div style={styles.placeholder}>
            <p>Train a model to see the confusion matrix</p>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Subgroup Analysis</h2>
          <div style={styles.placeholder}>
            <p>Subgroup performance analysis will appear here</p>
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
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "1rem",
    marginBottom: "2rem",
  },
  metricCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  metricLabel: {
    fontSize: "0.75rem",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
    marginBottom: "0.5rem",
  },
  metricValue: {
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#111827",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
    gap: "1.5rem",
  },
  card: {
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
  placeholder: {
    padding: "3rem",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
    textAlign: "center",
    color: "#6b7280",
    fontSize: "0.875rem",
  },
};
