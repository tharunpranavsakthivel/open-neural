/**
 * Training state store using Zustand-style implementation.
 *
 * Manages real-time training progress state including SSE updates,
 * experiment status, progress percentage, CPU/RAM usage, and per-model
 * run status. Persists training state across component mounts.
 *
 * @module stores/trainingStore
 */

/**
 * Run status for individual model training.
 */
export type RunStatus = "queued" | "running" | "done" | "failed";

/**
 * Experiment status values.
 */
export type ExperimentStatus =
  | "created"
  | "running"
  | "done"
  | "cancelled"
  | "interrupted";

/**
 * Metrics for a completed run.
 */
export interface RunMetrics {
  /** F1 score (for classification) */
  f1?: number;
  /** AUC-ROC score (for classification) */
  auc_roc?: number;
  /** Precision (for classification) */
  precision?: number;
  /** Recall (for classification) */
  recall?: number;
  /** RMSE (for regression) */
  rmse?: number;
  /** MAE (for regression) */
  mae?: number;
  /** R² score (for regression) */
  r2?: number;
}

/**
 * Individual run status entry.
 */
export interface RunStatusEntry {
  /** Model type key */
  model_type: string;
  /** Current status */
  status: RunStatus;
  /** Metrics if completed */
  metrics?: RunMetrics;
  /** Training time in seconds */
  training_time_sec?: number;
}

/**
 * SSE event payload for status updates.
 */
export interface SSEStatusUpdate {
  /** Current experiment status */
  status: ExperimentStatus;
  /** Progress percentage (0-100) */
  progress_pct: number;
  /** CPU usage percentage */
  cpu_pct: number;
  /** RAM used in GB */
  ram_used_gb: number;
  /** Total RAM in GB */
  ram_total_gb: number;
  /** Array of run statuses */
  runs: RunStatusEntry[];
}

/**
 * Training state interface.
 */
interface TrainingState {
  /** Current experiment ID */
  experimentId: string | null;
  /** Current experiment status */
  status: ExperimentStatus;
  /** Overall progress percentage */
  progressPct: number;
  /** CPU usage percentage */
  cpuPct: number;
  /** RAM used in GB */
  ramUsedGb: number;
  /** Total RAM in GB */
  ramTotalGb: number;
  /** Per-model run statuses */
  runs: RunStatusEntry[];
  /** Whether SSE connection is active */
  isConnected: boolean;
  /** Error message if connection failed */
  error: string | null;
}

/**
 * Training store interface including state and actions.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
interface TrainingStore extends TrainingState {
  /** Set the current experiment ID */
  setExperimentId: (id: string | null) => void;
  /** Update status from SSE payload */
  updateFromSSE: (payload: SSEStatusUpdate) => void;
  /** Set SSE connection status */
  setIsConnected: (connected: boolean) => void;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Reset store to initial state */
  reset: () => void;
}

// Store instance
let storeInstance: TrainingStore | null = null;

/**
 * Initial state factory.
 */
function getInitialState(): TrainingState {
  return {
    experimentId: null,
    status: "created",
    progressPct: 0,
    cpuPct: 0,
    ramUsedGb: 0,
    ramTotalGb: 0,
    runs: [],
    isConnected: false,
    error: null,
  };
}

/**
 * Initialize the training store singleton.
 *
 * @returns The training store instance
 */
function initializeStore(): TrainingStore {
  if (storeInstance !== null) {
    return storeInstance;
  }

  // Initial state
  let state: TrainingState = getInitialState();

  // Actions
  const setExperimentId = (id: string | null): void => {
    state = { ...state, experimentId: id };
  };

  const updateFromSSE = (payload: SSEStatusUpdate): void => {
    state = {
      ...state,
      status: payload.status,
      progressPct: payload.progress_pct,
      cpuPct: payload.cpu_pct,
      ramUsedGb: payload.ram_used_gb,
      ramTotalGb: payload.ram_total_gb,
      runs: payload.runs,
    };
  };

  const setIsConnected = (connected: boolean): void => {
    state = { ...state, isConnected: connected };
  };

  const setError = (error: string | null): void => {
    state = { ...state, error };
  };

  const reset = (): void => {
    state = getInitialState();
  };

  storeInstance = {
    ...state,
    setExperimentId,
    updateFromSSE,
    setIsConnected,
    setError,
    reset,
  };

  return storeInstance;
}

/**
 * Zustand-style hook for training state.
 *
 * @example
 * const { status, progressPct, updateFromSSE } = useTrainingStore();
 * useEffect(() => {
 *   eventSource.onmessage = (event) => {
 *     const payload = JSON.parse(event.data);
 *     updateFromSSE(payload);
 *   };
 * }, []);
 * @returns The training store with state and actions
 */
export function useTrainingStore(): TrainingStore {
  return initializeStore();
}
