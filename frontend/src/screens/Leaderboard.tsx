/**
 * Leaderboard screen - Step 6: Experiment comparison leaderboard.
 *
 * Displays all experiments in a sortable, interactive table.
 *
 * @module screens/Leaderboard
 */
interface LeaderboardProps {
  /** Currently selected project ID */
  projectId: string;
}

/**
 * Leaderboard wizard step component.
 *
 * @param props - Component props
 * @returns The leaderboard screen
 */
export function Leaderboard({ projectId: _projectId }: LeaderboardProps): JSX.Element {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Leaderboard</h1>
        <p style={styles.description}>
          Compare experiments and view performance rankings.
        </p>
      </header>

      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h2 style={styles.tableTitle}>Experiments</h2>
          <div style={styles.sortControls}>
            <label style={styles.sortLabel}>Sort by:</label>
            <select style={styles.sortSelect}>
              <option value="f1">F1 Score</option>
              <option value="auc_roc">AUC-ROC</option>
              <option value="precision">Precision</option>
              <option value="recall">Recall</option>
              <option value="training_time">Training Time</option>
            </select>
          </div>
        </div>

        <div style={styles.placeholder}>
          <p>No experiments yet. Train models to see results here.</p>
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
  tableCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.5rem",
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  tableTitle: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  sortControls: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  sortLabel: {
    fontSize: "0.875rem",
    color: "#6b7280",
  },
  sortSelect: {
    padding: "0.5rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    backgroundColor: "#ffffff",
  },
  placeholder: {
    padding: "4rem",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
    textAlign: "center",
    color: "#6b7280",
    fontSize: "0.875rem",
  },
};
