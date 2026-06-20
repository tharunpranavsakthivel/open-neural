/**
 * TrainingProgress screen - Displays real-time training progress.
 *
 * Renders the step description "Training is running locally on your machine —
 * no internet required." and displays an overall progress bar showing the
 * training completion status.
 *
 * This screen is shown during active training to provide visual feedback
 * on the training process without requiring internet connectivity.
 *
 * @module screens/TrainingProgress
 */

/**
 * Props for the TrainingProgress component.
 */
interface TrainingProgressProps {
  /** Current experiment ID being trained */
  experimentId?: string;
  /** Overall training progress percentage (0-100) */
  progressPct?: number;
  /** Current status of the training */
  status?: "running" | "done" | "cancelled" | "interrupted" | "created";
}

/**
 * Training progress screen component.
 *
 * Displays the training step description and an overall progress bar
 * to visualize training completion. This screen is used during the
 * training phase to provide real-time feedback to the user.
 *
 * @param props - Component props
 * @returns The training progress screen
 */
export function TrainingProgress({
  experimentId: _experimentId,
  progressPct = 0,
  status = "created",
}: TrainingProgressProps): JSX.Element {
  /**
   * Clamp progress percentage between 0 and 100.
   */
  const clampedProgress = Math.min(100, Math.max(0, progressPct));

  /**
   * Determine status label based on training state.
   */
  const getStatusLabel = (): string => {
    switch (status) {
      case "running":
        return "Training...";
      case "done":
        return "Training Complete";
      case "cancelled":
        return "Training Cancelled";
      case "interrupted":
        return "Training Interrupted";
      case "created":
      default:
        return "Ready to Train";
    }
  };

  /**
   * Determine if progress bar should show indeterminate animation.
   */
  const isIndeterminate = status === "created" || status === "running";

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Training Progress</h1>
        <p style={styles.description}>
          Training is running locally on your machine — no internet required.
        </p>
      </header>

      <div style={styles.progressCard}>
        <div style={styles.progressHeader}>
          <h2 style={styles.progressTitle}>Overall Progress</h2>
          <span
            style={{
              ...styles.statusBadge,
              ...(status === "done" ? styles.statusBadgeSuccess : {}),
              ...(status === "cancelled" || status === "interrupted"
                ? styles.statusBadgeError
                : {}),
            }}
          >
            {getStatusLabel()}
          </span>
        </div>

        <div style={styles.progressBarContainer}>
          <div
            style={{
              ...styles.progressBar,
              ...(isIndeterminate && clampedProgress === 0
                ? styles.progressBarIndeterminate
                : {}),
            }}
          >
            <div
              style={{
                ...styles.progressFill,
                width: `${clampedProgress}%`,
                ...(status === "done" ? styles.progressFillSuccess : {}),
                ...(status === "cancelled" || status === "interrupted"
                  ? styles.progressFillError
                  : {}),
              }}
            />
          </div>
          <span style={styles.progressText}>{Math.round(clampedProgress)}%</span>
        </div>

        <p style={styles.progressDescription}>
          {status === "running" && clampedProgress < 100
            ? "Training models in parallel on your local machine..."
            : status === "done"
              ? "All models have been trained and evaluated."
              : status === "cancelled"
                ? "Training was cancelled by the user."
                : status === "interrupted"
                  ? "Training was interrupted. You can restart from where it left off."
                  : "Waiting to start training..."}
        </p>
      </div>

      <div style={styles.infoCard}>
        <h2 style={styles.infoTitle}>What&apos;s Happening?</h2>
        <ul style={styles.infoList}>
          <li style={styles.infoItem}>
            <span style={styles.infoBullet}>•</span>
            <span style={styles.infoText}>
              Models are being trained locally using scikit-learn and XGBoost
            </span>
          </li>
          <li style={styles.infoItem}>
            <span style={styles.infoBullet}>•</span>
            <span style={styles.infoText}>
              Cross-validation is performed to ensure reliable performance estimates
            </span>
          </li>
          <li style={styles.infoItem}>
            <span style={styles.infoBullet}>•</span>
            <span style={styles.infoText}>
              Hyperparameter optimization runs automatically if AutoML is enabled
            </span>
          </li>
          <li style={styles.infoItem}>
            <span style={styles.infoBullet}>•</span>
            <span style={styles.infoText}>
              All processing happens on your machine — your data never leaves
            </span>
          </li>
        </ul>
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
  progressCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.5rem",
    marginBottom: "1.5rem",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.25rem",
  },
  progressTitle: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  statusBadge: {
    padding: "0.375rem 0.75rem",
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
    borderRadius: "9999px",
    fontSize: "0.75rem",
    fontWeight: 500,
  },
  statusBadgeSuccess: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  statusBadgeError: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  progressBarContainer: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "1rem",
  },
  progressBar: {
    flex: 1,
    height: "12px",
    backgroundColor: "#e5e7eb",
    borderRadius: "6px",
    overflow: "hidden",
    position: "relative",
  },
  progressBarIndeterminate: {
    backgroundColor: "#f3f4f6",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2563eb",
    borderRadius: "6px",
    transition: "width 0.3s ease",
  },
  progressFillSuccess: {
    backgroundColor: "#22c55e",
  },
  progressFillError: {
    backgroundColor: "#ef4444",
  },
  progressText: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#374151",
    minWidth: "40px",
    textAlign: "right",
  },
  progressDescription: {
    margin: 0,
    fontSize: "0.875rem",
    color: "#6b7280",
  },
  infoCard: {
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.5rem",
  },
  infoTitle: {
    margin: "0 0 1rem 0",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  infoList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  infoItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
    marginBottom: "0.75rem",
    fontSize: "0.875rem",
    color: "#374151",
  },
  infoBullet: {
    color: "#2563eb",
    fontWeight: 600,
  },
  infoText: {
    lineHeight: 1.5,
  },
};
