/**
 * TrainingProgress screen - Displays real-time training progress with SSE.
 *
 * Renders the step description "Training is running locally on your machine —
 * no internet required." and displays an overall progress bar showing the
 * training completion status.
 *
 * This screen connects to the backend SSE stream at
 * GET /api/v1/experiments/{id}/stream to receive real-time updates on training
 * progress, CPU/RAM usage, and per-model run status. The connection is
 * automatically closed when the experiment reaches a terminal status
 * (done, cancelled, interrupted).
 *
 * @module screens/TrainingProgress
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { useTrainingStore, type SSEStatusUpdate } from "../stores/trainingStore";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { cancelExperiment } from "../utils/api";

/**
 * Props for the TrainingProgress component.
 */
interface TrainingProgressProps {
  /** Current experiment ID being trained */
  experimentId: string;
  /** Callback when training completes (status becomes "done") */
  onTrainingComplete?: () => void;
  /** Callback when training is cancelled or interrupted */
  onTrainingCancelled?: () => void;
  /** Callback to navigate back to model selection */
  onReturnToModelSelection?: () => void;
}

/**
 * Check if experiment status is terminal (connection should close).
 *
 * @param status - Current experiment status
 * @returns Whether the status is terminal
 */
function isTerminalStatus(
  status: "running" | "done" | "cancelled" | "interrupted" | "created"
): boolean {
  return status === "done" || status === "cancelled" || status === "interrupted";
}

/**
 * Training progress screen component.
 *
 * Displays the training step description and an overall progress bar
 * to visualize training completion. Connects to the backend SSE stream
 * to receive real-time updates and dispatches them to the training store.
 * Includes cancel functionality with confirmation dialog.
 *
 * @param props - Component props
 * @returns The training progress screen
 */
export function TrainingProgress({
  experimentId,
  onTrainingComplete,
  onTrainingCancelled,
  onReturnToModelSelection,
}: TrainingProgressProps): JSX.Element {
  const {
    status,
    progressPct,
    cpuPct,
    ramUsedGb,
    ramTotalGb,
    isConnected,
    error,
    setExperimentId,
    updateFromSSE,
    setIsConnected,
    setError,
    reset,
  } = useTrainingStore();

  /**
   * State for cancel confirmation dialog.
   */
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  /**
   * State for cancel operation loading.
   */
  const [isCancelling, setIsCancelling] = useState(false);

  /**
   * EventSource reference for cleanup.
   */
  const eventSourceRef = useRef<EventSource | null>(null);

  /**
   * Cleanup function to close SSE connection.
   */
  const closeSSEConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, [setIsConnected]);

  /**
   * Initialize SSE connection on mount.
   *
   * Connects to GET /api/v1/experiments/{id}/stream using the native
   * EventSource API. Parses incoming SSE payloads and dispatches them
   * to the Zustand training store. Closes the connection on terminal status.
   */
  useEffect(() => {
    /**
     * Initialize the SSE connection to the backend stream endpoint.
     *
     * The connection uses EventSource for server-sent events. Each message
     * contains a JSON payload with status updates that are dispatched to
     * the training store.
     */
    async function initializeSSE(): Promise<void> {
      try {
        // Get backend port from Electron API
        const port = await window.electronAPI.getBackendPort();
        if (port === null) {
          throw new Error("Backend port not available");
        }

        // Construct SSE endpoint URL
        const sseUrl = `http://127.0.0.1:${port}/api/v1/experiments/${experimentId}/stream`;

        // Create EventSource connection
        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        // Handle connection open
        eventSource.onopen = () => {
          setIsConnected(true);
          setError(null);
        };

        // Handle incoming messages
        eventSource.onmessage = (event: MessageEvent) => {
          try {
            const payload = JSON.parse(event.data) as SSEStatusUpdate;

            // Validate payload structure
            if (
              typeof payload === "object" &&
              payload !== null &&
              "status" in payload &&
              "progress_pct" in payload &&
              "cpu_pct" in payload &&
              "ram_used_gb" in payload &&
              "ram_total_gb" in payload &&
              "runs" in payload
            ) {
              // Dispatch to training store
              updateFromSSE(payload);

              // Check for terminal status and close connection
              if (isTerminalStatus(payload.status)) {
                closeSSEConnection();

                // Trigger callbacks based on final status
                if (payload.status === "done" && onTrainingComplete) {
                  onTrainingComplete();
                } else if (
                  (payload.status === "cancelled" || payload.status === "interrupted") &&
                  onTrainingCancelled
                ) {
                  onTrainingCancelled();
                }
              }
            } else {
              console.warn("Invalid SSE payload structure:", payload);
            }
          } catch (parseError) {
            console.error("Failed to parse SSE message:", parseError);
            setError("Failed to parse server message");
          }
        };

        // Handle errors
        eventSource.onerror = (error: Event) => {
          console.error("SSE connection error:", error);
          setIsConnected(false);
          setError("Connection to training stream failed");

          // Close the connection on error
          eventSource.close();
          eventSourceRef.current = null;
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to connect to training stream";
        setError(errorMessage);
        setIsConnected(false);
      }
    }

    // Set the experiment ID in store
    setExperimentId(experimentId);

    // Initialize SSE connection
    initializeSSE();

    // Cleanup on unmount
    return () => {
      closeSSEConnection();
      // Reset store when component unmounts
      reset();
    };
  }, [
    experimentId,
    setExperimentId,
    updateFromSSE,
    setIsConnected,
    setError,
    closeSSEConnection,
    onTrainingComplete,
    onTrainingCancelled,
    reset,
  ]);

  /**
   * Handle cancel button click - open confirmation dialog.
   */
  const handleCancelClick = useCallback(() => {
    setIsCancelDialogOpen(true);
  }, []);

  /**
   * Handle cancel confirmation - call API to cancel training.
   */
  const handleCancelConfirm = useCallback(async () => {
    try {
      setIsCancelling(true);

      // Call API to cancel the experiment
      await cancelExperiment(experimentId);

      // Close the dialog
      setIsCancelDialogOpen(false);

      // Close SSE connection
      closeSSEConnection();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to cancel training";
      setError(errorMessage);
      setIsCancelDialogOpen(false);
    } finally {
      setIsCancelling(false);
    }
  }, [experimentId, closeSSEConnection, setError]);

  /**
   * Handle cancel dialog close.
   */
  const handleCancelDialogClose = useCallback(() => {
    if (!isCancelling) {
      setIsCancelDialogOpen(false);
    }
  }, [isCancelling]);

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

  /**
   * Format RAM usage for display.
   */
  const formatRam = (gb: number): string => {
    return gb.toFixed(1);
  };

  /**
   * Check if training can be cancelled (only while running).
   */
  const canCancel = status === "running" && !isCancelling;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Training Progress</h1>
        <p style={styles.description}>
          Training is running locally on your machine — no internet required.
        </p>
      </header>

      {/* Connection Status */}
      {isConnected && status === "running" && (
        <div style={styles.connectionBadge}>
          <span style={styles.connectionDot} />
          Live updates
        </div>
      )}
      {error && (
        <div style={styles.errorBanner}>
          <span style={styles.errorIcon}>⚠</span>
          {error}
        </div>
      )}

      {/* Cancelled State - Return Button */}
      {(status === "cancelled" || status === "interrupted") && (
        <div style={styles.cancelledStateCard}>
          <div style={styles.cancelledStateHeader}>
            <span style={styles.cancelledStateIcon}>⛔</span>
            <h2 style={styles.cancelledStateTitle}>
              {status === "cancelled" ? "Training Cancelled" : "Training Interrupted"}
            </h2>
          </div>
          <p style={styles.cancelledStateDescription}>
            {status === "cancelled"
              ? "Training was cancelled by the user. Partial results have been discarded."
              : "Training was interrupted unexpectedly. You can restart from where it left off."}
          </p>
          {onReturnToModelSelection && (
            <button
              onClick={onReturnToModelSelection}
              style={styles.returnButton}
            >
              Return to Model Selection
            </button>
          )}
        </div>
      )}

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
              ...(status === "running" ? styles.statusBadgeRunning : {}),
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

        {/* Cancel Training Button - Only shown while running */}
        {canCancel && (
          <div style={styles.cancelButtonContainer}>
            <button
              onClick={handleCancelClick}
              disabled={isCancelling}
              style={styles.cancelButton}
            >
              {isCancelling ? (
                <>
                  <span style={styles.buttonSpinner} />
                  Cancelling...
                </>
              ) : (
                "Cancel Training"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Resource Usage */}
      {status === "running" && (
        <div style={styles.resourceCard}>
          <h2 style={styles.resourceTitle}>Resource Usage</h2>
          <div style={styles.resourceGrid}>
            <div style={styles.resourceItem}>
              <span style={styles.resourceLabel}>CPU</span>
              <div style={styles.resourceBarContainer}>
                <div
                  style={{
                    ...styles.resourceBar,
                    width: `${Math.min(100, cpuPct)}%`,
                  }}
                />
              </div>
              <span style={styles.resourceValue}>{cpuPct.toFixed(1)}%</span>
            </div>
            <div style={styles.resourceItem}>
              <span style={styles.resourceLabel}>RAM</span>
              <div style={styles.resourceBarContainer}>
                <div
                  style={{
                    ...styles.resourceBar,
                    width: `${Math.min(100, (ramUsedGb / (ramTotalGb || 1)) * 100)}%`,
                  }}
                />
              </div>
              <span style={styles.resourceValue}>
                {formatRam(ramUsedGb)} / {formatRam(ramTotalGb)} GB
              </span>
            </div>
          </div>
        </div>
      )}

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

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isCancelDialogOpen}
        title="Cancel Training?"
        description="Are you sure you want to cancel training? This will stop all model training immediately and partial results will be discarded. This action cannot be undone."
        confirmText="Cancel Training"
        cancelText="Continue Training"
        isDestructive={true}
        onConfirm={handleCancelConfirm}
        onCancel={handleCancelDialogClose}
      />
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
  connectionBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.375rem 0.75rem",
    backgroundColor: "#dcfce7",
    color: "#166534",
    borderRadius: "9999px",
    fontSize: "0.75rem",
    fontWeight: 500,
    marginBottom: "1rem",
  },
  connectionDot: {
    width: "8px",
    height: "8px",
    backgroundColor: "#22c55e",
    borderRadius: "50%",
    animation: "pulse 2s ease-in-out infinite",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.75rem 1rem",
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    borderRadius: "6px",
    fontSize: "0.875rem",
    marginBottom: "1rem",
  },
  errorIcon: {
    fontSize: "1rem",
  },
  cancelledStateCard: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    padding: "1.5rem",
    marginBottom: "1.5rem",
  },
  cancelledStateHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "0.75rem",
  },
  cancelledStateIcon: {
    fontSize: "1.5rem",
  },
  cancelledStateTitle: {
    margin: 0,
    fontSize: "1.125rem",
    fontWeight: 600,
    color: "#991b1b",
  },
  cancelledStateDescription: {
    margin: "0 0 1rem 0",
    fontSize: "0.875rem",
    color: "#7f1d1d",
    lineHeight: 1.5,
  },
  returnButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#ffffff",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
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
  statusBadgeRunning: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
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
    margin: "0 0 1rem 0",
    fontSize: "0.875rem",
    color: "#6b7280",
  },
  cancelButtonContainer: {
    marginTop: "1.25rem",
    paddingTop: "1rem",
    borderTop: "1px solid #e5e7eb",
  },
  cancelButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    width: "100%",
    padding: "0.75rem 1.5rem",
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  buttonSpinner: {
    width: "16px",
    height: "16px",
    border: "2px solid rgba(153, 27, 27, 0.3)",
    borderTop: "2px solid #991b1b",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  resourceCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.5rem",
    marginBottom: "1.5rem",
  },
  resourceTitle: {
    margin: "0 0 1rem 0",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  resourceGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  resourceItem: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  resourceLabel: {
    width: "50px",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
  },
  resourceBarContainer: {
    flex: 1,
    height: "8px",
    backgroundColor: "#e5e7eb",
    borderRadius: "4px",
    overflow: "hidden",
  },
  resourceBar: {
    height: "100%",
    backgroundColor: "#2563eb",
    borderRadius: "4px",
    transition: "width 0.3s ease",
  },
  resourceValue: {
    width: "100px",
    fontSize: "0.875rem",
    color: "#6b7280",
    textAlign: "right",
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
