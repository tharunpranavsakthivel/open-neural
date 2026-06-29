/**
 * Projects API module.
 * 
 * Provides typed Axios-based wrappers for project and dashboard statistics endpoints.
 * 
 * @module api/projects
 */
import { getApiClient } from "./client";
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
 * API response for project rename/update operation.
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
 * API response for project create operation.
 */
export interface CreateProjectResponse {
  /** The created project */
  project: Project;
}

/**
 * Fetch all projects from the backend.
 * 
 * GET /api/v1/projects
 * 
 * @returns Array of project metadata objects
 */
export async function fetchProjects(): Promise<Project[]> {
  const client = getApiClient();
  const response = await client.get<ProjectsResponse>("/projects");
  return response.data.projects;
}

/**
 * Fetch dashboard statistics from the backend.
 * 
 * GET /api/v1/dashboard/stats
 * 
 * @returns Dashboard statistics (experiments, exports, snapshots)
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const client = getApiClient();
  const response = await client.get<DashboardStats>("/dashboard/stats");
  return response.data;
}

/**
 * Rename a project using PUT.
 * 
 * PUT /api/v1/projects/{projectId}
 * 
 * @param projectId - The ID of the project to rename
 * @param newName - The new name for the project
 * @returns The updated project
 */
export async function renameProject(
  projectId: string,
  newName: string
): Promise<Project> {
  const client = getApiClient();
  const response = await client.put<RenameProjectResponse>(`/projects/${projectId}`, {
    name: newName,
  });
  return response.data.project;
}

/**
 * Rename a project using PATCH (partial update).
 * 
 * PATCH /api/v1/projects/{projectId}
 * 
 * @param projectId - The ID of the project to rename
 * @param newName - The new name for the project
 * @returns The updated project
 */
export async function patchProject(
  projectId: string,
  newName: string
): Promise<Project> {
  const client = getApiClient();
  const response = await client.patch<RenameProjectResponse>(`/projects/${projectId}`, {
    name: newName,
  });
  return response.data.project;
}

/**
 * Delete a project.
 * 
 * DELETE /api/v1/projects/{projectId}
 * 
 * @param projectId - The ID of the project to delete
 * @returns Whether the deletion was successful
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  const client = getApiClient();
  const response = await client.delete<DeleteProjectResponse>(`/projects/${projectId}`);
  return response.data.deleted;
}

/**
 * Create a new project.
 * 
 * POST /api/v1/projects
 * 
 * @param name - The name of the project
 * @param taskType - The type of ML task
 * @returns The created project
 */
export async function createProject(
  name: string,
  taskType: "binary_classification" | "multiclass_classification" | "regression"
): Promise<Project> {
  const client = getApiClient();
  const response = await client.post<CreateProjectResponse>("/projects", {
    name,
    task_type: taskType,
  });
  return response.data.project;
}
