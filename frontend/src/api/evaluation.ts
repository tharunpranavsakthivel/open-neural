/**
 * Evaluation API module.
 * 
 * Provides typed Axios-based wrappers for experiment evaluations and metric thresholds.
 * 
 * @module api/evaluation
 */
import { getApiClient } from "./client";

/**
 * Subgroup analysis item from the backend.
 */
export interface SubgroupAnalysis {
  /** Name of the slice/subgroup */
  slice_name: string;
  /** Sample count in this subgroup */
  n: number;
  /** Metrics for this subgroup */
  metrics: {
    f1?: number;
    recall?: number;
    precision?: number;
  };
}

/**
 * Confusion matrix from the backend.
 */
export interface ConfusionMatrix {
  /** True negatives */
  tn: number;
  /** False positives */
  fp: number;
  /** False negatives */
  fn: number;
  /** True positives */
  tp: number;
}

/**
 * Classification metrics from the backend.
 */
export interface ClassificationMetrics {
  /** F1 score */
  f1: number;
  /** AUC-ROC score */
  auc_roc: number;
  /** Precision */
  precision: number;
  /** Recall */
  recall: number;
}

/**
 * Evaluation response from the backend.
 */
export interface EvaluationResponse {
  /** ID of the best performing run */
  best_run_id: string;
  /** Type of the best model */
  best_model_type: string;
  /** Evaluation metrics */
  metrics: ClassificationMetrics;
  /** Confusion matrix for binary/multiclass classification */
  confusion_matrix: ConfusionMatrix;
  /** Current decision threshold */
  threshold: number;
  /** Subgroup analyses for fairness/performance breakdown */
  subgroup_analyses: SubgroupAnalysis[];
}

/**
 * Threshold update response from the backend.
 */
export interface UpdateThresholdResponse {
  /** Updated precision */
  precision: number;
  /** Updated recall */
  recall: number;
  /** Updated F1 score */
  f1: number;
}

/**
 * Fetch evaluation data for an experiment.
 * 
 * GET /api/v1/experiments/{experimentId}/evaluation
 * 
 * @param experimentId - The ID of the experiment
 * @returns Evaluation data including metrics, confusion matrix, and subgroup analyses
 */
export async function fetchExperimentEvaluation(
  experimentId: string
): Promise<EvaluationResponse> {
  const client = getApiClient();
  const response = await client.get<EvaluationResponse>(
    `/experiments/${experimentId}/evaluation`
  );
  return response.data;
}

/**
 * Update the decision threshold for binary classification.
 * 
 * POST /api/v1/experiments/{experimentId}/evaluation/threshold
 * 
 * @param experimentId - The ID of the experiment
 * @param threshold - The new threshold value (0.10-0.90)
 * @returns Updated metrics at the new threshold
 */
export async function updateEvaluationThreshold(
  experimentId: string,
  threshold: number
): Promise<UpdateThresholdResponse> {
  const client = getApiClient();
  const response = await client.post<UpdateThresholdResponse>(
    `/experiments/${experimentId}/evaluation/threshold`,
    { threshold }
  );
  return response.data;
}
