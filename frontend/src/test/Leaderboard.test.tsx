import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Leaderboard } from "../screens/Leaderboard";

// Mock API
vi.mock("../utils/api", () => {
  return {
    fetchLeaderboard: vi.fn(),
  };
});

import { fetchLeaderboard } from "../utils/api";

describe("Leaderboard Component Tests", () => {
  const projectId = "proj-xyz";

  const mockEntries = [
    {
      experiment_id: "exp-1",
      experiment_id_human: "EXP-001",
      best_model_type: "Random Forest",
      metrics: {
        f1: 0.8851,
        auc_roc: 0.9122,
        precision: 0.8911,
        recall: 0.8792,
      },
      training_time_seconds: 45,
      is_best: true,
    },
    {
      experiment_id: "exp-2",
      experiment_id_human: "EXP-002",
      best_model_type: "Logistic Regression",
      metrics: {
        f1: 0.7421,
        auc_roc: 0.7812,
        precision: 0.7391,
        recall: 0.7451,
      },
      training_time_seconds: 12,
      is_best: false,
    },
    {
      experiment_id: "exp-3",
      experiment_id_human: "EXP-003",
      best_model_type: "XGBoost",
      metrics: {
        f1: 0.8722,
        auc_roc: 0.9011,
        precision: 0.8652,
        recall: 0.8793,
      },
      training_time_seconds: 124,
      is_best: false,
    },
    {
      experiment_id: "exp-4",
      experiment_id_human: "EXP-004",
      best_model_type: "Support Vector Machine",
      metrics: {
        f1: 0.8122,
        auc_roc: 0.8512,
        precision: 0.8091,
        recall: 0.8153,
      },
      training_time_seconds: 94,
      is_best: false,
    },
    {
      experiment_id: "exp-5",
      experiment_id_human: "EXP-005",
      best_model_type: "Neural Network",
      metrics: {
        f1: 0.8643,
        auc_roc: 0.8931,
        precision: 0.8542,
        recall: 0.8745,
      },
      training_time_seconds: 350,
      is_best: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render 5 experiment rows, show the BEST badge on is_best:true, and call API with sort_by=f1&order=asc when F1 header is clicked", async () => {
    // Initial fetch on mount returns the 5 mock rows
    vi.mocked(fetchLeaderboard as any).mockResolvedValue(mockEntries as any);

    render(<Leaderboard projectId={projectId} />);

    // Renders spinner first
    expect(screen.getByText("Loading leaderboard...")).toBeInTheDocument();

    // Wait for mock response to render
    await waitFor(() => {
      expect(screen.getByText("EXP-001")).toBeInTheDocument();
      expect(screen.getByText("EXP-002")).toBeInTheDocument();
      expect(screen.getByText("EXP-003")).toBeInTheDocument();
      expect(screen.getByText("EXP-004")).toBeInTheDocument();
      expect(screen.getByText("EXP-005")).toBeInTheDocument();
    });

    // Check that is_best: true has the "BEST" badge
    const bestBadge = screen.getByText("BEST");
    expect(bestBadge).toBeInTheDocument();

    // Verify initial API call parameters on mount
    expect(fetchLeaderboard).toHaveBeenLastCalledWith(projectId, "f1", "desc");

    // Click the F1 column header to sort ascending (it currently shows "F1 ▼")
    const f1Header = screen.getByRole("button", { name: "F1 ▼" });
    await userEvent.click(f1Header);

    // Verify that the subsequent API call included sort_by=f1 and order=asc
    await waitFor(() => {
      expect(fetchLeaderboard).toHaveBeenLastCalledWith(projectId, "f1", "asc");
    });
  });
});
