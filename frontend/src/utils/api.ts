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
 * Rename a project.
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
