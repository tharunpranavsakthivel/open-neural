import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectsDashboard } from "../screens/ProjectsDashboard";

// Mock API functions
vi.mock("../utils/api", () => {
  return {
    fetchProjects: vi.fn(),
    fetchDashboardStats: vi.fn(),
    patchProject: vi.fn(),
    deleteProject: vi.fn(),
    createProject: vi.fn(),
  };
});

import { fetchProjects, fetchDashboardStats, deleteProject } from "../utils/api";

describe("ProjectsDashboard Component Tests", () => {
  const mockOnSelectProject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render project list correctly when projects exist", async () => {
    const mockProjects = [
      {
        id: "proj-1",
        name: "Project One",
        taskType: "classification" as const,
        experimentCount: 3,
        updatedAt: new Date().toISOString(),
      },
    ];
    const mockStats = {
      totalExperiments: 3,
      totalExports: 1,
      totalSnapshots: 2,
    };

    vi.mocked(fetchProjects).mockResolvedValue(mockProjects);
    vi.mocked(fetchDashboardStats).mockResolvedValue(mockStats);

    render(<ProjectsDashboard onSelectProject={mockOnSelectProject} />);

    // Assert spinner first
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Project One")).toBeInTheDocument();
      expect(screen.getByText("Total Experiments")).toBeInTheDocument();
      expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("should open ConfirmDialog on clicking delete button and call delete API upon confirmation", async () => {
    const mockProjects = [
      {
        id: "proj-1",
        name: "Project One",
        taskType: "classification" as const,
        experimentCount: 3,
        updatedAt: new Date().toISOString(),
      },
    ];
    const mockStats = {
      totalExperiments: 3,
      totalExports: 1,
      totalSnapshots: 2,
    };

    vi.mocked(fetchProjects).mockResolvedValue(mockProjects);
    vi.mocked(fetchDashboardStats).mockResolvedValue(mockStats);
    vi.mocked(deleteProject).mockResolvedValue(true);

    render(<ProjectsDashboard onSelectProject={mockOnSelectProject} />);

    await waitFor(() => {
      expect(screen.getByText("Project One")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole("button", { name: "Delete project Project One" });
    await userEvent.click(deleteBtn);

    // Confirm dialog should be open
    expect(screen.getByText("Delete Project")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Deleting this project will permanently remove all experiments, snapshots, and exports. This cannot be undone."
      )
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Delete this action" });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteProject).toHaveBeenCalledWith("proj-1");
    });
  });

  it("should render empty state CTA when the project list is empty", async () => {
    vi.mocked(fetchProjects).mockResolvedValue([]);
    vi.mocked(fetchDashboardStats).mockResolvedValue({
      totalExperiments: 0,
      totalExports: 0,
      totalSnapshots: 0,
    });

    render(<ProjectsDashboard onSelectProject={mockOnSelectProject} />);

    await waitFor(() => {
      expect(screen.getByText("Create your first project")).toBeInTheDocument();
      expect(screen.getByText("Import your dataset")).toBeInTheDocument();
    });
  });
});
