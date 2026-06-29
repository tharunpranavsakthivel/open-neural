/**
 * Training state store using Zustand.
 *
 * Manages real-time training progress state including SSE updates,
 * experiment status, progress percentage, CPU/RAM usage, and per-model
 * run status. Persists training state across component mounts.
 *
 * @module stores/trainingStore
 */
import { create } from "zustand";

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
 * Training store state interface.
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
 * Training store actions interface.
 */
interface TrainingActions {
  /** Set the current experiment ID */
  setExperimentId: (id: string | null) => void;
  /** Update status from SSE payload */
  updateFromSSEPayload: (payload: SSEStatusUpdate) => void;
  /** Legacy/Compatibility alias for updateFromSSEPayload */
  updateFromSSE: (payload: SSEStatusUpdate) => void;
  /** Set SSE connection status */
  setIsConnected: (connected: boolean) => void;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Reset store to initial state */
  resetTraining: () => void;
  /** Legacy/Compatibility alias for resetTraining */
  reset: () => void;
}

/**
 * Combined training store type.
 */
export type TrainingStore = TrainingState & TrainingActions;

/**
 * Initial training state.
 */
const initialState: TrainingState = {
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

/**
 * Zustand store for managing training state and real-time SSE updates.
 */
export const useTrainingStore = create<TrainingStore>((set: any) => ({
  ...initialState,

  setExperimentId: (id: string | null): void => {
    set(() => ({ experimentId: id }));
  },

  updateFromSSEPayload: (payload: SSEStatusUpdate): void => {
    set(() => ({
      status: payload.status,
      progressPct: payload.progress_pct,
      cpuPct: payload.cpu_pct,
      ramUsedGb: payload.ram_used_gb,
      ramTotalGb: payload.ram_total_gb,
      runs: payload.runs,
    }));
  },

  updateFromSSE: (payload: SSEStatusUpdate): void => {
    set(() => ({
      status: payload.status,
      progressPct: payload.progress_pct,
      cpuPct: payload.cpu_pct,
      ramUsedGb: payload.ram_used_gb,
      ramTotalGb: payload.ram_total_gb,
      runs: payload.runs,
    }));
  },

  setIsConnected: (connected: boolean): void => {
    set(() => ({ isConnected: connected }));
  },

  setError: (error: string | null): void => {
    set(() => ({ error }));
  },

  resetTraining: (): void => {
    set(() => initialState);
  },

  reset: (): void => {
    set(() => initialState);
  },
}));

/**
 * Hook selector for accessing individual training state values.
 * Use this when you only need a specific value to minimize re-renders.
 */
export const useTrainingSelector = useTrainingStore;

/**
 * Get the current training state.
 * Useful for non-component contexts.
 */
export function getTrainingState(): TrainingState {
  const state = useTrainingStore.getState();
  return {
    experimentId: state.experimentId,
    status: state.status,
    progressPct: state.progressPct,
    cpuPct: state.cpuPct,
    ramUsedGb: state.ramUsedGb,
    ramTotalGb: state.ramTotalGb,
    runs: state.runs,
    isConnected: state.isConnected,
    error: state.error,
  };
}
