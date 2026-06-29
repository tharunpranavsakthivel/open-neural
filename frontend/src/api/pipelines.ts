/**
 * Pipelines API module.
 *
 * Provides typed Axios-based wrappers for pipeline management and validation.
 *
 * @module api/pipelines
 */
import { getApiClient } from "./client";

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
 * @returns The created pipeline response
 */
export async function createPipeline(
  projectId: string,
  request: CreatePipelineRequest,
): Promise<PipelineResponse> {
  const client = getApiClient();
  const response = await client.post<PipelineResponse>(
    `/projects/${projectId}/pipelines`,
    request,
  );
  return response.data;
}

/**
 * Fetch all pipelines for a project.
 *
 * GET /api/v1/projects/{projectId}/pipelines
 *
 * @param projectId - The ID of the project
 * @returns Array of pipeline responses
 */
export async function fetchProjectPipelines(
  projectId: string,
): Promise<PipelineResponse[]> {
  const client = getApiClient();
  const response = await client.get<PipelineResponse[]>(
    `/projects/${projectId}/pipelines`,
  );
  return response.data;
}

/**
 * Validate a saved pipeline configuration.
 *
 * GET /api/v1/projects/{projectId}/pipelines/{pipelineId}/validate
 *
 * @param projectId - The ID of the project
 * @param pipelineId - The ID of the pipeline to validate
 * @returns Validation result
 */
export async function validatePipeline(
  projectId: string,
  pipelineId: string,
): Promise<PipelineValidationResult> {
  const client = getApiClient();
  const response = await client.get<PipelineValidationResult>(
    `/projects/${projectId}/pipelines/${pipelineId}/validate`,
  );
  return response.data;
}

/**
 * Validate a pipeline configuration without saving (dry run).
 *
 * POST /api/v1/projects/{projectId}/pipelines/validate
 *
 * @param projectId - The ID of the project
 * @param request - The pipeline configuration to validate
 * @returns Validation result
 */
export async function validatePipelineConfig(
  projectId: string,
  request: CreatePipelineRequest,
): Promise<PipelineValidationResult> {
  const client = getApiClient();
  const response = await client.post<PipelineValidationResult>(
    `/projects/${projectId}/pipelines/validate`,
    request,
  );
  return response.data;
}
