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

function mapProject(raw: any): Project {
  if (!raw) return raw;
  return {
    id: raw.id,
    name: raw.name,
    taskType: raw.task_type ?? raw.taskType,
    experimentCount: raw.experiment_count ?? raw.experimentCount ?? 0,
    updatedAt: raw.updated_at ?? raw.updatedAt ?? new Date().toISOString(),
  };
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
  const response = await client.get<any>("/projects");
  const data = response.data;
  if (Array.isArray(data)) {
    return data.map(mapProject);
  }
  if (data && typeof data === "object" && "projects" in data && Array.isArray(data.projects)) {
    return data.projects.map(mapProject);
  }
  return [];
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
  newName: string,
): Promise<Project> {
  const client = getApiClient();
  const response = await client.put<any>(
    `/projects/${projectId}`,
    {
      name: newName,
    },
  );
  const data = response.data;
  if (data && typeof data === "object") {
    if ("project" in data) {
      return mapProject(data.project);
    }
    return mapProject(data);
  }
  throw new Error("Invalid response format for renameProject");
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
  newName: string,
): Promise<Project> {
  const client = getApiClient();
  const response = await client.patch<any>(
    `/projects/${projectId}`,
    {
      name: newName,
    },
  );
  const data = response.data;
  if (data && typeof data === "object") {
    if ("project" in data) {
      return mapProject(data.project);
    }
    return mapProject(data);
  }
  throw new Error("Invalid response format for patchProject");
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
  const response = await client.delete<any>(
    `/projects/${projectId}`,
  );
  const data = response.data;
  if (typeof data === "boolean") {
    return data;
  }
  if (data && typeof data === "object" && "deleted" in data) {
    return !!data.deleted;
  }
  return true;
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
  taskType:
    "binary_classification" | "multiclass_classification" | "regression",
): Promise<Project> {
  const client = getApiClient();
  const mappedTaskType = taskType === "regression" ? "regression" : "classification";
  const response = await client.post<any>("/projects", {
    name,
    task_type: mappedTaskType,
  });
  const data = response.data;
  if (data && typeof data === "object") {
    if ("project" in data) {
      return mapProject(data.project);
    }
    return mapProject(data);
  }
  throw new Error("Invalid response format for createProject");
}
