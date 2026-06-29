/**
 * CrashRecoveryBanner component - Displays recovery options for interrupted experiments.
 *
 * Renders a banner when interrupted experiments are detected on app launch.
 * Provides "Restart" and "Discard" actions for each interrupted experiment.
 * Calls PATCH /api/v1/experiments/{id}/recover with the selected action.
 *
 * @module components/CrashRecoveryBanner
 */
import { useState, useCallback } from "react";
import { recoverExperiment } from "../utils/api";

/**
 * Interrupted experiment data.
 */
export interface InterruptedExperiment {
  /** Unique experiment ID (UUID) */
  id: string;
  /** Human-readable experiment ID */
  experiment_id_human: string;
  /** ID of the project this experiment belongs to */
  project_id: string;
  /** Name of the project */
  project_name?: string;
  /** Current experiment status */
  status: "interrupted";
  /** Timestamp when the experiment was created */
  created_at: string;
  /** Timestamp when the experiment was started */
  started_at?: string;
  /** Best model type from the partial run */
  best_model_type?: string;
  /** Partial metrics from the interrupted run */
  metrics?: {
    f1?: number;
    auc_roc?: number;
    precision?: number;
    recall?: number;
  };
}

/**
 * Props for the CrashRecoveryBanner component.
 */
interface CrashRecoveryBannerProps {
  /** List of interrupted experiments to display */
  interruptedExperiments: InterruptedExperiment[];
  /** Callback when an experiment is restarted */
  onRestart?: (experimentId: string, projectId: string) => void;
  /** Callback when an experiment is discarded */
  onDiscard?: (experimentId: string) => void;
  /** Callback when all experiments are handled */
  onDismiss?: () => void;
}

/**
 * Format date for display.
 *
 * @param dateString - ISO date string
 * @returns Formatted date
 */
function formatDate(dateString: string | undefined): string {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Crash recovery banner component.
 *
 * Displays interrupted experiments with restart and discard options.
 * Handles API calls and loading states for recovery actions.
 *
 * @param props - Component props
 * @returns The crash recovery banner
 */
export function CrashRecoveryBanner({
  interruptedExperiments,
  onRestart,
  onDiscard,
  onDismiss,
}: CrashRecoveryBannerProps): JSX.Element | null {
  /**
   * Track loading state for each experiment action.
   */
  const [loadingStates, setLoadingStates] = useState<
    Record<
      string,
      {
        action: "restart" | "discard" | null;
        isLoading: boolean;
      }
    >
  >({});

  /**
   * Track handled experiments (to hide them after action).
   */
  const [handledExperiments, setHandledExperiments] = useState<Set<string>>(
    new Set(),
  );

  /**
   * Handle restart action.
   */
  const handleRestart = useCallback(
    async (experiment: InterruptedExperiment) => {
      try {
        setLoadingStates((prev) => ({
          ...prev,
          [experiment.id]: { action: "restart", isLoading: true },
        }));

        await recoverExperiment(experiment.id, "restart");

        // Mark as handled
        setHandledExperiments((prev) => new Set([...prev, experiment.id]));

        // Call callback
        if (onRestart) {
          onRestart(experiment.id, experiment.project_id);
        }
      } catch (error) {
        console.error("Failed to restart experiment:", error);
        // Keep the experiment visible on error
      } finally {
        setLoadingStates((prev) => ({
          ...prev,
          [experiment.id]: { action: null, isLoading: false },
        }));
      }
    },
    [onRestart],
  );

  /**
   * Handle discard action.
   */
  const handleDiscard = useCallback(
    async (experiment: InterruptedExperiment) => {
      try {
        setLoadingStates((prev) => ({
          ...prev,
          [experiment.id]: { action: "discard", isLoading: true },
        }));

        await recoverExperiment(experiment.id, "discard");

        // Mark as handled
        setHandledExperiments((prev) => new Set([...prev, experiment.id]));

        // Call callback
        if (onDiscard) {
          onDiscard(experiment.id);
        }

        // Check if all experiments are handled
        const remaining = interruptedExperiments.filter(
          (e) => !handledExperiments.has(e.id) && e.id !== experiment.id,
        );
        if (remaining.length === 0 && onDismiss) {
          onDismiss();
        }
      } catch (error) {
        console.error("Failed to discard experiment:", error);
        // Keep the experiment visible on error
      } finally {
        setLoadingStates((prev) => ({
          ...prev,
          [experiment.id]: { action: null, isLoading: false },
        }));
      }
    },
    [interruptedExperiments, handledExperiments, onDiscard, onDismiss],
  );

  /**
   * Get primary metric value to display.
   */
  const getPrimaryMetric = (experiment: InterruptedExperiment): string => {
    if (!experiment.metrics) return "—";
    const metric = experiment.metrics.f1 ?? experiment.metrics.auc_roc;
    return metric !== undefined ? metric.toFixed(4) : "—";
  };

  // Filter out handled experiments
  const visibleExperiments = interruptedExperiments.filter(
    (e) => !handledExperiments.has(e.id),
  );

  if (visibleExperiments.length === 0) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconContainer}>
          <span style={styles.icon}>⚠️</span>
        </div>
        <div style={styles.headerText}>
          <h2 style={styles.title}>Training Interrupted</h2>
          <p style={styles.subtitle}>
            {visibleExperiments.length === 1
              ? "A training session was interrupted. You can restart or discard it."
              : `${visibleExperiments.length} training sessions were interrupted. You can restart or discard them.`}
          </p>
        </div>
      </div>

      <div style={styles.experimentsList}>
        {visibleExperiments.map((experiment) => {
          const loadingState = loadingStates[experiment.id];
          const isLoading = loadingState?.isLoading ?? false;
          const currentAction = loadingState?.action;

          return (
            <div key={experiment.id} style={styles.experimentCard}>
              <div style={styles.experimentInfo}>
                <div style={styles.experimentHeader}>
                  <span style={styles.experimentId}>
                    {experiment.experiment_id_human}
                  </span>
                  <span style={styles.experimentProject}>
                    {experiment.project_name || "Unknown Project"}
                  </span>
                </div>
                <div style={styles.experimentDetails}>
                  <span style={styles.detailItem}>
                    Started: {formatDate(experiment.started_at)}
                  </span>
                  {experiment.best_model_type && (
                    <span style={styles.detailItem}>
                      Best model: {experiment.best_model_type}
                    </span>
                  )}
                  {experiment.metrics && (
                    <span style={styles.detailItem}>
                      Best F1: {getPrimaryMetric(experiment)}
                    </span>
                  )}
                </div>
              </div>

              <div style={styles.actions}>
                <button
                  onClick={() => handleDiscard(experiment)}
                  disabled={isLoading}
                  style={{
                    ...styles.discardButton,
                    ...(isLoading && currentAction === "discard"
                      ? styles.buttonLoading
                      : {}),
                  }}
                >
                  {isLoading && currentAction === "discard" ? (
                    <>
                      <span style={styles.buttonSpinner} />
                      Discarding...
                    </>
                  ) : (
                    "Discard"
                  )}
                </button>
                <button
                  onClick={() => handleRestart(experiment)}
                  disabled={isLoading}
                  style={{
                    ...styles.restartButton,
                    ...(isLoading && currentAction === "restart"
                      ? styles.buttonLoading
                      : {}),
                  }}
                >
                  {isLoading && currentAction === "restart" ? (
                    <>
                      <span style={styles.buttonSpinner} />
                      Restarting...
                    </>
                  ) : (
                    "Restart"
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {visibleExperiments.length > 1 && (
        <div style={styles.dismissContainer}>
          <button onClick={onDismiss} style={styles.dismissButton}>
            Dismiss All
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: "#fef3c7",
    border: "1px solid #fcd34d",
    borderRadius: "8px",
    padding: "1.5rem",
    marginBottom: "1.5rem",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: "1rem",
    marginBottom: "1rem",
  },
  iconContainer: {
    flexShrink: 0,
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fde68a",
    borderRadius: "8px",
  },
  icon: {
    fontSize: "1.5rem",
  },
  headerText: {
    flex: 1,
  },
  title: {
    margin: "0 0 0.25rem 0",
    fontSize: "1.125rem",
    fontWeight: 600,
    color: "#92400e",
  },
  subtitle: {
    margin: 0,
    fontSize: "0.875rem",
    color: "#a16207",
    lineHeight: 1.5,
  },
  experimentsList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  experimentCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "1rem",
    backgroundColor: "#ffffff",
    border: "1px solid #fcd34d",
    borderRadius: "6px",
  },
  experimentInfo: {
    flex: 1,
    minWidth: 0,
  },
  experimentHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "0.5rem",
    flexWrap: "wrap",
  },
  experimentId: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#111827",
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  experimentProject: {
    fontSize: "0.75rem",
    color: "#6b7280",
    padding: "0.125rem 0.5rem",
    backgroundColor: "#f3f4f6",
    borderRadius: "4px",
  },
  experimentDetails: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    flexWrap: "wrap",
  },
  detailItem: {
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    flexShrink: 0,
  },
  restartButton: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 1rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  discardButton: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 1rem",
    backgroundColor: "#ffffff",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  buttonLoading: {
    opacity: 0.7,
    cursor: "not-allowed",
  },
  buttonSpinner: {
    width: "14px",
    height: "14px",
    border: "2px solid currentColor",
    borderTop: "2px solid transparent",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  dismissContainer: {
    marginTop: "1rem",
    paddingTop: "1rem",
    borderTop: "1px solid #fcd34d",
    display: "flex",
    justifyContent: "flex-end",
  },
  dismissButton: {
    padding: "0.5rem 1rem",
    backgroundColor: "transparent",
    color: "#92400e",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "color 0.15s ease",
  },
};
