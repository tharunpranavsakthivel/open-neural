/**
 * Crash recovery module for the Electron main process.
 *
 * Detects interrupted experiments on application startup by querying the
 * Python backend API. Notifies the renderer process via IPC when interrupted
 * experiments are found so the user can restart or discard them.
 *
 * An experiment is considered "interrupted" if its status is "interrupted",
 * which occurs when:
 * - The application crashed during training
 * - The machine lost power during training
 * - The Python backend process was killed unexpectedly
 *
 * @module crash-recovery
 */
import { getBackendPort, getBackendSecret } from "./process-manager";

/**
 * Represents an interrupted experiment returned by the backend API.
 */
export interface InterruptedExperiment {
  /** Unique experiment ID (UUID) */
  id: string;
  /** Human-readable experiment ID (e.g., "exp_cxp8_1015") */
  experiment_id_human: string;
  /** ID of the project this experiment belongs to */
  project_id: string;
  /** Name of the project */
  project_name?: string;
  /** Current experiment status (always "interrupted" for these records) */
  status: "interrupted";
  /** Timestamp when the experiment was created */
  created_at: string;
  /** Timestamp when the experiment was started (if available) */
  started_at?: string;
  /** Best model type from the partial run (if available) */
  best_model_type?: string;
  /** Partial metrics from the interrupted run (if available) */
  metrics?: {
    f1?: number;
    auc_roc?: number;
    precision?: number;
    recall?: number;
  };
}

/**
 * Result of checking for interrupted experiments.
 */
export interface CrashCheckResult {
  /** Whether the check succeeded (backend available) */
  success: boolean;
  /** Error message if the check failed */
  error?: string;
  /** List of interrupted experiments (empty if none found) */
  interruptedExperiments: InterruptedExperiment[];
}

/**
 * Checks for interrupted experiments by calling the backend API.
 *
 * This function queries `GET /api/v1/experiments/interrupted` to retrieve
 * all experiments with status "interrupted" across all projects. These
 * experiments require user action to either restart or discard.
 *
 * @returns CrashCheckResult with the list of interrupted experiments
 */
export async function checkInterruptedExperiments(): Promise<CrashCheckResult> {
  const port = getBackendPort();
  const secret = getBackendSecret();

  if (port === null || secret === null) {
    return {
      success: false,
      error: "Backend not available",
      interruptedExperiments: []
    };
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/v1/experiments/interrupted`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-OpenNeural-Secret": secret
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: `Backend returned ${response.status}: ${errorText}`,
        interruptedExperiments: []
      };
    }

    const data = await response.json() as {
      interrupted_experiments: InterruptedExperiment[];
    };

    return {
      success: true,
      interruptedExperiments: data.interrupted_experiments ?? []
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to check for interrupted experiments: ${errorMessage}`,
      interruptedExperiments: []
    };
  }
}
