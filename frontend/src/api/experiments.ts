/**
 * Experiments API module.
 *
 * Provides typed Axios-based wrappers for experiment life cycle, training estimations,
 * and interrupted/crash-recovery operations.
 *
 * @module api/experiments
 */
import { getApiClient } from "./client";
import { getCurrentProjectId } from "../stores/appStore";

/**
 * Training time estimate response from the backend.
 */
export interface TrainingTimeEstimateResponse {
  /** Estimated training time in minutes */
  estimated_minutes: number;
  /** Whether the estimate is advisory (may differ from actual time) */
  is_advisory: boolean;
  /** Number of models that will be trained */
  model_count: number;
  /** Dataset row count used for estimation */
  row_count: number;
  /** Dataset column count used for estimation */
  col_count: number;
}

/**
 * Request parameters for training time estimation.
 */
export interface TrainingTimeEstimateRequest {
  /** Pipeline ID to use for estimation */
  pipeline_id: string;
  /** Selected model keys */
  candidate_models: string[];
  /** Maximum number of AutoML trials */
  max_trials: number;
  /** Number of cross-validation folds */
  cv_folds: number;
}

/**
 * Experiment creation response from the backend.
 */
export interface CreateExperimentResponse {
  /** Unique identifier for the experiment */
  id: string;
  /** Human-readable experiment ID */
  experiment_id_human: string;
  /** Current status */
  status: "created";
  /** Creation timestamp */
  created_at: string;
}

/**
 * Request body for creating a new experiment.
 */
export interface CreateExperimentRequest {
  /** Pipeline ID to use */
  pipeline_id: string;
  /** Whether AutoML is enabled */
  automl_enabled: boolean;
  /** Optimization metric */
  optimize_metric: string;
  /** AutoML configuration */
  automl_config: {
    max_trials: number;
    cv_folds: number;
    time_budget_minutes: number;
  };
  /** Candidate model keys */
  candidate_models: string[];
}

/**
 * Start experiment training response.
 */
export interface StartExperimentResponse {
  /** Current status */
  status: "running";
  /** Start timestamp */
  started_at: string;
}

/**
 * Cancel experiment training response.
 */
export interface CancelExperimentResponse {
  /** Current status */
  status: "cancelled";
}

/**
 * Interrupted experiment response from the backend.
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
 * Response for interrupted experiments list.
 */
export interface InterruptedExperimentsResponse {
  /** List of interrupted experiments */
  interrupted_experiments: InterruptedExperiment[];
}

/**
 * Recover experiment response.
 */
export interface RecoverExperimentResponse {
  /** Current status after recovery action */
  status: "created" | "cancelled";
  /** Recovery action taken */
  action: "restart" | "discard";
}

/**
 * Fetch training time estimate for the given configuration.
 *
 * POST /api/v1/experiments/estimate
 *
 * @param request - The configuration to estimate training time for
 * @returns Training time estimate with metadata
 */
export async function fetchTrainingTimeEstimate(
  request: TrainingTimeEstimateRequest,
): Promise<TrainingTimeEstimateResponse> {
  const client = getApiClient();
  const response = await client.post<TrainingTimeEstimateResponse>(
    "/experiments/estimate",
    request,
  );
  return response.data;
}

/**
 * Create a new experiment for a project.
 *
 * POST /api/v1/projects/{projectId}/experiments
 *
 * @param projectId - The ID of the project
 * @param request - The experiment configuration
 * @returns The created experiment response
 */
export async function createExperiment(
  projectId: string,
  request: CreateExperimentRequest,
): Promise<CreateExperimentResponse> {
  const client = getApiClient();
  const response = await client.post<CreateExperimentResponse>(
    `/projects/${projectId}/experiments`,
    request,
  );
  return response.data;
}

/**
 * Start training for an experiment.
 *
 * POST /api/v1/experiments/{experimentId}/start
 *
 * @param experimentId - The ID of the experiment
 * @returns The started experiment status
 */
export async function startExperiment(
  experimentId: string,
  projectId?: string,
): Promise<StartExperimentResponse> {
  const client = getApiClient();
  const projId = projectId || getCurrentProjectId();
  if (!projId) {
    throw new Error("No active project ID found to start experiment.");
  }
  const response = await client.post<StartExperimentResponse>(
    `/projects/${projId}/experiments/${experimentId}/start`,
  );
  return response.data;
}

/**
 * Cancel training for an experiment.
 *
 * DELETE /api/v1/experiments/{experimentId}/cancel
 *
 * @param experimentId - The ID of the experiment
 * @returns The cancelled experiment status
 */
export async function cancelExperiment(
  experimentId: string,
  projectId?: string,
): Promise<CancelExperimentResponse> {
  const client = getApiClient();
  const projId = projectId || getCurrentProjectId();
  if (!projId) {
    throw new Error("No active project ID found to cancel experiment.");
  }
  const response = await client.delete<CancelExperimentResponse>(
    `/projects/${projId}/experiments/${experimentId}/cancel`,
  );
  return response.data;
}

/**
 * Fetch all interrupted experiments across all projects.
 *
 * GET /api/v1/experiments/interrupted
 *
 * @returns List of interrupted experiments
 */
export async function fetchInterruptedExperiments(): Promise<
  InterruptedExperiment[]
> {
  const client = getApiClient();
  const response = await client.get<InterruptedExperimentsResponse>(
    "/experiments/interrupted",
  );
  return response.data.interrupted_experiments ?? [];
}

/**
 * Recover an interrupted experiment by restarting or discarding it.
 *
 * PATCH /api/v1/experiments/{experimentId}/recover
 *
 * @param experimentId - The ID of the interrupted experiment
 * @param action - The recovery action: "restart" or "discard"
 * @returns The recovered experiment status
 */
export async function recoverExperiment(
  experimentId: string,
  action: "restart" | "discard",
): Promise<RecoverExperimentResponse> {
  const client = getApiClient();
  const response = await client.patch<RecoverExperimentResponse>(
    `/experiments/${experimentId}/recover`,
    { action },
  );
  return response.data;
}
