/**
 * Snapshots API module.
 * 
 * Provides typed Axios-based wrappers for dataset snapshot uploading and retrieval.
 * 
 * @module api/snapshots
 */
import { getApiClient } from "./client";
import { useDatasetStore } from "../stores/datasetStore";

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
  /** Whether a memory warning should be displayed */
  memory_warning?: boolean;
  /** Advisory message for memory warning */
  memory_warning_message?: string;
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
 * Upload a dataset file to create a snapshot.
 * 
 * POST /api/v1/projects/{projectId}/snapshots
 * 
 * @param projectId - The ID of the project
 * @param file - The file to upload
 * @param onProgress - Optional callback for upload progress (0-100)
 * @returns The created snapshot response
 */
export async function uploadDatasetSnapshot(
  projectId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<DatasetSnapshotResponse> {
  const client = getApiClient();
  const formData = new FormData();
  formData.append("file", file);

  const response = await client.post<DatasetSnapshotResponse>(
    `/projects/${projectId}/snapshots`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          useDatasetStore.getState().setUploadProgress(progress);
          if (onProgress) {
            onProgress(progress);
          }
        }
      },
    }
  );

  return response.data;
}

/**
 * Fetch all snapshots for a project.
 * 
 * GET /api/v1/projects/{projectId}/snapshots
 * 
 * @param projectId - The ID of the project
 * @returns Array of snapshot list items
 */
export async function fetchProjectSnapshots(
  projectId: string
): Promise<SnapshotListItem[]> {
  const client = getApiClient();
  const response = await client.get<SnapshotListItem[]>(
    `/projects/${projectId}/snapshots`
  );
  return response.data;
}
