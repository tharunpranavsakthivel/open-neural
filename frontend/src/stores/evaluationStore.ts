/**
 * Evaluation state store using Zustand.
 *
 * Manages model evaluation metrics, selected decision threshold,
 * and updates threshold-adjusted metrics for display.
 *
 * @module stores/evaluationStore
 */
import { create } from "zustand";
import { type EvaluationResponse } from "../utils/api";

/**
 * Evaluation result type alias.
 */
export type EvaluationResult = EvaluationResponse;

/**
 * Evaluation store state interface.
 */
interface EvaluationState {
  /** Evaluation result from the backend, null if not loaded */
  evaluation: EvaluationResult | null;
  /** Selected decision threshold for binary classification */
  selectedThreshold: number;
}

/**
 * Evaluation store actions interface.
 */
interface EvaluationActions {
  /**
   * Set the evaluation result.
   *
   * @param evaluation - The evaluation result or null to clear
   */
  setEvaluation: (evaluation: EvaluationResult | null) => void;

  /**
   * Set the selected decision threshold.
   *
   * @param threshold - The threshold value (0.10 - 0.90)
   */
  setThreshold: (threshold: number) => void;

  /**
   * Update evaluation metrics on decision threshold change.
   * Updates F1, precision, and recall in the current evaluation metrics object.
   *
   * @param metrics - Object containing the updated precision, recall, and f1 scores
   */
  updateThresholdMetrics: (metrics: {
    precision: number;
    recall: number;
    f1: number;
  }) => void;

  /**
   * Clear the evaluation store state.
   */
  clearEvaluationStore: () => void;
}

/**
 * Combined evaluation store type.
 */
export type EvaluationStore = EvaluationState & EvaluationActions;

/**
 * Initial evaluation state.
 */
const initialState: EvaluationState = {
  evaluation: null,
  selectedThreshold: 0.5,
};

/**
 * Evaluation store using Zustand.
 *
 * @example
 * const { evaluation, selectedThreshold, setEvaluation, setThreshold } = useEvaluationStore();
 */
export const useEvaluationStore = create<EvaluationStore>((set: any) => ({
  ...initialState,

  setEvaluation: (evaluation: EvaluationResult | null): void => {
    set(() => ({
      evaluation,
      // Default to the threshold returned by backend if available
      selectedThreshold: evaluation ? evaluation.threshold : 0.5,
    }));
  },

  setThreshold: (threshold: number): void => {
    set(() => ({
      selectedThreshold: threshold,
    }));
  },

  updateThresholdMetrics: (metrics: {
    precision: number;
    recall: number;
    f1: number;
  }): void => {
    set((state: EvaluationStore) => {
      if (!state.evaluation) return state;

      return {
        evaluation: {
          ...state.evaluation,
          metrics: {
            ...state.evaluation.metrics,
            ...metrics,
          },
        },
      };
    });
  },

  clearEvaluationStore: (): void => {
    set(() => initialState);
  },
}));

/**
 * Hook selector for accessing individual evaluation state values.
 * Use this when you only need a specific value to minimize re-renders.
 */
export const useEvaluationSelector = useEvaluationStore;

/**
 * Get the current evaluation result from the store.
 * Useful for non-component contexts.
 *
 * @returns The current evaluation result or null
 */
export function getEvaluationResult(): EvaluationResult | null {
  return useEvaluationStore.getState().evaluation;
}

/**
 * Get the current selected threshold from the store.
 *
 * @returns The selected threshold
 */
export function getSelectedThreshold(): number {
  return useEvaluationStore.getState().selectedThreshold;
}
