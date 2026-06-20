/**
 * API utility for communicating with the OpenNeural Python backend.
 *
 * Provides typed HTTP client methods for fetching projects, stats, and other
 * data from the FastAPI backend. The base URL is constructed using the
 * backend port retrieved from the Electron main process.
 *
 * @module utils/api
 */
import type { Project } from "../stores/appStore";

/**
 * Dashboard statistics response from the backend.
 */
export interface DashboardStats {
  /** Total number of experiments across all projects */
  totalExperiments: number;
  /** Total number of exports (models, reports, etc.) */
  totalExports: number;
  /** Total number of dataset snapshots */
  totalSnapshots: number;
}

/**
 * Full API response for the projects list endpoint.
 */
export interface ProjectsResponse {
  /** Array of project metadata */
  projects: Project[];
}

/**
 * API response for project rename operation.
 */
export interface RenameProjectResponse {
  /** The updated project */
  project: Project;
}

/**
 * API response for project delete operation.
 */
export interface DeleteProjectResponse {
  /** Whether the deletion was successful */
  deleted: boolean;
}

/**
 * Request body for creating a new project.
 */
export interface CreateProjectRequest {
  /** Name of the project */
  name: string;
  /** Type of ML task */
  task_type: "binary_classification" | "multiclass_classification" | "regression";
}

/**
 * API response for project create operation.
 */
export interface CreateProjectResponse {
  /** The created project */
  project: Project;
}

/**
 * Get the base API URL using the backend port from the Electron API.
 *
 * @returns The base URL for API requests (e.g., "http://127.0.0.1:52841")
 * @throws Error if the backend port is not available
 */
async function getBaseUrl(): Promise<string> {
  const port = await window.electronAPI.getBackendPort();
  if (port === null) {
    throw new Error("Backend port not available");
  }
  return `http://127.0.0.1:${port}`;
}

/**
 * Fetch all projects from the backend.
 *
 * GET /api/v1/projects
 *
 * @returns Array of project metadata objects
 * @throws Error if the request fails
 */
export async function fetchProjects(): Promise<Project[]> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/projects`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch projects: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as ProjectsResponse;
  return data.projects;
}

/**
 * Fetch dashboard statistics from the backend.
 *
 * GET /api/v1/dashboard/stats
 *
 * @returns Dashboard statistics (experiments, exports, snapshots)
 * @throws Error if the request fails
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/dashboard/stats`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch stats: ${response.status} ${errorText}`);
  }

  return (await response.json()) as DashboardStats;
}

/**
 * Rename a project using PUT.
 *
 * PUT /api/v1/projects/{projectId}
 *
 * @param projectId - The ID of the project to rename
 * @param newName - The new name for the project
 * @returns The updated project
 * @throws Error if the request fails
 */
export async function renameProject(
  projectId: string,
  newName: string
): Promise<Project> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/projects/${projectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: newName }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to rename project: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as RenameProjectResponse;
  return data.project;
}

/**
 * Rename a project using PATCH (partial update).
 *
 * PATCH /api/v1/projects/{projectId}
 *
 * @param projectId - The ID of the project to rename
 * @param newName - The new name for the project
 * @returns The updated project
 * @throws Error if the request fails
 */
export async function patchProject(
  projectId: string,
  newName: string
): Promise<Project> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/projects/${projectId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: newName }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to rename project: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as RenameProjectResponse;
  return data.project;
}

/**
 * Delete a project.
 *
 * DELETE /api/v1/projects/{projectId}
 *
 * @param projectId - The ID of the project to delete
 * @returns Whether the deletion was successful
 * @throws Error if the request fails
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/projects/${projectId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete project: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as DeleteProjectResponse;
  return data.deleted;
}

/**
 * Create a new project.
 *
 * POST /api/v1/projects
 *
 * @param name - The name of the project
 * @param taskType - The type of ML task
 * @returns The created project
 * @throws Error if the request fails
 */
export async function createProject(
  name: string,
  taskType: "binary_classification" | "multiclass_classification" | "regression"
): Promise<Project> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, task_type: taskType }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create project: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as CreateProjectResponse;
  return data.project;
}

/**
 * Dataset snapshot response from the backend.
 */
export interface DatasetSnapshotResponse {
  /** Unique identifier for the snapshot */
  id: string;
  /** Human-readable version label */
  version_label: string;
  /** Original file name */
  file_name: string;
  /** File size in bytes */
  file_size_bytes: number;
  /** Number of rows */
  row_count: number;
  /** Number of columns */
  col_count: number;
  /** Inferred schema */
  schema: Array<{
    name: string;
    inferred_type: string;
    null_pct: number;
    unique_count: number;
  }>;
  /** SHA-256 checksum */
  checksum_sha256: string;
  /** UTC timestamp */
  created_at: string;
  /** Whether a memory warning should be displayed (NFR-PERF-06) */
  memory_warning?: boolean;
  /** Advisory message for memory warning */
  memory_warning_message?: string;
}

/**
 * Upload a dataset file to create a snapshot.
 *
 * POST /api/v1/projects/{projectId}/snapshots
 *
 * @param projectId - The ID of the project
 * @param file - The file to upload
 * @param onProgress - Optional callback for upload progress (0-100)
 * @returns The created snapshot
 * @throws Error if the request fails
 */
export async function uploadDatasetSnapshot(
  projectId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<DatasetSnapshotResponse> {
  const baseUrl = await getBaseUrl();
  const formData = new FormData();
  formData.append("file", file);

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as DatasetSnapshotResponse;
          resolve(data);
        } catch (err) {
          reject(new Error("Failed to parse server response"));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was aborted"));
    });

    xhr.open("POST", `${baseUrl}/api/v1/projects/${projectId}/snapshots`);
    xhr.send(formData);
  });
}

/**
 * Snapshot list item from the backend.
 */
export interface SnapshotListItem {
  /** Unique identifier for the snapshot */
  id: string;
  /** Human-readable version label */
  version_label: string;
  /** Number of rows */
  row_count: number;
  /** UTC timestamp */
  created_at: string;
}

/**
 * Fetch all snapshots for a project.
 *
 * GET /api/v1/projects/{projectId}/snapshots
 *
 * @param projectId - The ID of the project
 * @returns Array of snapshot list items
 * @throws Error if the request fails
 */
export async function fetchProjectSnapshots(
  projectId: string
): Promise<SnapshotListItem[]> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/projects/${projectId}/snapshots`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch snapshots: ${response.status} ${errorText}`);
  }

  return (await response.json()) as SnapshotListItem[];
}

/**
 * Pipeline block configuration for API requests.
 */
export interface PipelineBlockConfig {
  /** Block type identifier */
  type: string;
  /** Block parameters */
  params: Record<string, unknown>;
}

/**
 * Pipeline configuration request body.
 */
export interface CreatePipelineRequest {
  /** Snapshot ID to associate with this pipeline */
  snapshot_id: string;
  /** Ordered array of pipeline blocks */
  blocks: PipelineBlockConfig[];
}

/**
 * Pipeline validation result.
 */
export interface PipelineValidationResult {
  /** Whether the pipeline is valid */
  valid: boolean;
  /** Array of validation warnings */
  warnings: Array<{
    block_index?: number;
    message: string;
  }>;
  /** Array of validation errors */
  errors: Array<{
    block_index?: number;
    message: string;
  }>;
}

/**
 * Pipeline response from the backend.
 */
export interface PipelineResponse {
  /** Unique identifier for the pipeline */
  id: string;
  /** Project ID */
  project_id: string;
  /** Associated snapshot ID */
  snapshot_id: string;
  /** Pipeline configuration JSON */
  config_json: {
    blocks: PipelineBlockConfig[];
  };
  /** Whether the pipeline has been validated */
  validated: boolean;
  /** Creation timestamp */
  created_at: string;
}

/**
 * Create a new pipeline for a project.
 *
 * POST /api/v1/projects/{projectId}/pipelines
 *
 * @param projectId - The ID of the project
 * @param request - The pipeline configuration
 * @returns The created pipeline
 * @throws Error if the request fails
 */
export async function createPipeline(
  projectId: string,
  request: CreatePipelineRequest
): Promise<PipelineResponse> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/projects/${projectId}/pipelines`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create pipeline: ${response.status} ${errorText}`);
  }

  return (await response.json()) as PipelineResponse;
}

/**
 * Fetch all pipelines for a project.
 *
 * GET /api/v1/projects/{projectId}/pipelines
 *
 * @param projectId - The ID of the project
 * @returns Array of pipeline responses
 * @throws Error if the request fails
 */
export async function fetchProjectPipelines(
  projectId: string
): Promise<PipelineResponse[]> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/projects/${projectId}/pipelines`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch pipelines: ${response.status} ${errorText}`);
  }

  return (await response.json()) as PipelineResponse[];
}

/**
 * Validate a pipeline configuration.
 *
 * GET /api/v1/projects/{projectId}/pipelines/{pipelineId}/validate
 *
 * @param projectId - The ID of the project
 * @param pipelineId - The ID of the pipeline to validate
 * @returns Validation result
 * @throws Error if the request fails
 */
export async function validatePipeline(
  projectId: string,
  pipelineId: string
): Promise<PipelineValidationResult> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/v1/projects/${projectId}/pipelines/${pipelineId}/validate`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to validate pipeline: ${response.status} ${errorText}`);
  }

  return (await response.json()) as PipelineValidationResult;
}

/**
 * Validate a pipeline configuration without saving (dry run).
 *
 * POST /api/v1/projects/{projectId}/pipelines/validate
 *
 * @param projectId - The ID of the project
 * @param request - The pipeline configuration to validate
 * @returns Validation result
 * @throws Error if the request fails
 */
export async function validatePipelineConfig(
  projectId: string,
  request: CreatePipelineRequest
): Promise<PipelineValidationResult> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/v1/projects/${projectId}/pipelines/validate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to validate pipeline: ${response.status} ${errorText}`);
  }

  return (await response.json()) as PipelineValidationResult;
}

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
 * Fetch training time estimate for the given configuration.
 *
 * POST /api/v1/experiments/estimate
 *
 * @param request - The configuration to estimate training time for
 * @returns Training time estimate with metadata
 * @throws Error if the request fails
 */
export async function fetchTrainingTimeEstimate(
  request: TrainingTimeEstimateRequest
): Promise<TrainingTimeEstimateResponse> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/experiments/estimate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch time estimate: ${response.status} ${errorText}`);
  }

  return (await response.json()) as TrainingTimeEstimateResponse;
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
 * Create a new experiment for a project.
 *
 * POST /api/v1/projects/{projectId}/experiments
 *
 * @param projectId - The ID of the project
 * @param request - The experiment configuration
 * @returns The created experiment
 * @throws Error if the request fails
 */
export async function createExperiment(
  projectId: string,
  request: CreateExperimentRequest
): Promise<CreateExperimentResponse> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/v1/projects/${projectId}/experiments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create experiment: ${response.status} ${errorText}`);
  }

  return (await response.json()) as CreateExperimentResponse;
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
 * Start training for an experiment.
 *
 * POST /api/v1/experiments/{experimentId}/start
 *
 * @param experimentId - The ID of the experiment
 * @returns The started experiment status
 * @throws Error if the request fails
 */
export async function startExperiment(
  experimentId: string
): Promise<StartExperimentResponse> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/v1/experiments/${experimentId}/start`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to start experiment: ${response.status} ${errorText}`);
  }

  return (await response.json()) as StartExperimentResponse;
}
