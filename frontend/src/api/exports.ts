/**
 * Exports API module.
 *
 * Provides typed Axios-based wrappers for exporting experiment artifacts.
 *
 * @module api/exports
 */
import { getApiClient } from "./client";

/**
 * Export artifact type options.
 */
export type ExportArtifactType =
  "model" | "pipeline" | "report" | "predictions";

/**
 * Export request payload.
 */
export interface ExportRequest {
  /** Array of artifact types to export */
  artifacts: ExportArtifactType[];
  /** Local directory path where artifacts should be saved */
  destination_dir: string;
  /** Optional format configurations (e.g. model formats such as ["onnx", "joblib"]) */
  formats?: {
    model?: string[];
    [key: string]: string[] | undefined;
  };
}

/**
 * Single exported artifact entry.
 */
export interface ExportedArtifact {
  artifact: ExportArtifactType;
  path: string;
  size_bytes: number;
  checksum_sha256: string;
}

/**
 * Export artifacts response from the backend.
 */
export interface ExportResponse {
  /** List of successfully exported artifacts */
  exports: ExportedArtifact[];
  /** Path to the generated manifest file */
  manifest_path: string | null;
  /** Overall job status: success, partial_failure, or failed */
  status: "success" | "partial_failure" | "failed";
  /** Descriptive status message */
  message: string;
  /** List of errors encountered during execution (if any) */
  errors?: string[];
}

/**
 * Export artifacts from an experiment.
 *
 * POST /api/v1/experiments/{experimentId}/export
 *
 * @param experimentId - The ID of the experiment to export from
 * @param request - The export configuration payload
 * @returns Details of exported files and manifest path
 */
export async function exportExperiment(
  experimentId: string,
  request: ExportRequest,
): Promise<ExportResponse> {
  const client = getApiClient();
  const response = await client.post<ExportResponse>(
    `/experiments/${experimentId}/export`,
    request,
  );
  return response.data;
}
