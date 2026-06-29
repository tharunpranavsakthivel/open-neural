/**
 * Leaderboard API module.
 * 
 * Provides typed Axios-based wrappers for retrieving the project leaderboard.
 * 
 * @module api/leaderboard
 */
import { getApiClient } from "./client";

/**
 * Single experiment entry in the leaderboard response.
 */
export interface LeaderboardEntry {
  /** UUID of the experiment */
  experiment_id: string;
  /** Human-readable experiment ID (e.g., "exp_cxp8_1015") */
  experiment_id_human: string;
  /** Type of the best model for this experiment */
  best_model_type: string;
  /** Dict of metrics (f1, auc_roc, precision, recall, training_time) */
  metrics: {
    f1?: number;
    auc_roc?: number;
    precision?: number;
    recall?: number;
    rmse?: number;
    mae?: number;
    r2?: number;
    accuracy?: number;
  };
  /** Training duration in seconds */
  training_time_seconds: number;
  /** Flag indicating if this is the globally best experiment */
  is_best: boolean;
  /** ISO8601 timestamp when experiment was created */
  created_at: string;
}

/**
 * Sort column options for the leaderboard.
 */
export type LeaderboardSortBy = "f1" | "auc_roc" | "precision" | "recall" | "training_time";

/**
 * Sort order options for the leaderboard.
 */
export type LeaderboardOrder = "asc" | "desc";

/**
 * Fetch the experiment leaderboard for a project.
 * 
 * GET /api/v1/projects/{projectId}/leaderboard?sort_by={sortBy}&order={order}
 * 
 * @param projectId - The ID of the project
 * @param sortBy - Column to sort by (default: "f1")
 * @param order - Sort order, "asc" or "desc" (default: "desc")
 * @returns Array of leaderboard entries, sorted by the requested column
 */
export async function fetchLeaderboard(
  projectId: string,
  sortBy: LeaderboardSortBy = "f1",
  order: LeaderboardOrder = "desc"
): Promise<LeaderboardEntry[]> {
  const client = getApiClient();
  const response = await client.get<LeaderboardEntry[]>(
    `/projects/${projectId}/leaderboard`,
    {
      params: {
        sort_by: sortBy,
        order: order,
      },
    }
  );
  return response.data;
}
