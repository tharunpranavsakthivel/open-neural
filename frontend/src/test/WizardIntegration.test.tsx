import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAppStore } from "../stores/appStore";
import { AppShell } from "../components/AppShell";

// Mock all API calls with safe, Promise-returning defaults
vi.mock("../utils/api", () => {
  return {
    fetchProjects: vi.fn().mockResolvedValue([]),
    fetchDashboardStats: vi.fn().mockResolvedValue({
      totalExperiments: 0,
      totalExports: 0,
      totalSnapshots: 0,
    }),
    fetchInterruptedExperiments: vi.fn().mockResolvedValue([]),
    fetchProjectSnapshots: vi.fn().mockResolvedValue([]),
    uploadDatasetSnapshot: vi.fn().mockResolvedValue({ snapshot: {} }),
    fetchTrainingTimeEstimate: vi.fn().mockResolvedValue({ estimated_seconds: 10, requires_gpu: false }),
    createExperiment: vi.fn().mockResolvedValue({ id: "mock-exp-id", project_id: "mock-proj", status: "pending" }),
    startExperiment: vi.fn().mockResolvedValue({ success: true }),
    cancelExperiment: vi.fn().mockResolvedValue({ success: true }),
    fetchExperimentEvaluation: vi.fn().mockResolvedValue({
      best_run_id: "mock-run-id",
      best_model_type: "Random Forest",
      metrics: { f1: 0.5, auc_roc: 0.5, precision: 0.5, recall: 0.5 },
      confusion_matrix: { tn: 0, fp: 0, fn: 0, tp: 0 },
      threshold: 0.5,
      subgroup_analyses: [],
    }),
    fetchLeaderboard: vi.fn().mockResolvedValue([]),
    savePipeline: vi.fn().mockResolvedValue({ id: "pipe-1", blocks: [] }),
    fetchPipeline: vi.fn().mockResolvedValue({ id: "pipe-1", blocks: [] }),
    createPipeline: vi.fn().mockResolvedValue({ id: "pipe-1", blocks: [] }),
    validatePipelineConfig: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
    fetchProjectPipelines: vi.fn().mockResolvedValue([]),
    createProject: vi.fn().mockResolvedValue({}),
    renameProject: vi.fn().mockResolvedValue({}),
    deleteProject: vi.fn().mockResolvedValue({ success: true }),
    patchProject: vi.fn().mockResolvedValue({}),
  };
});

import {
  fetchProjects,
  fetchDashboardStats,
  fetchProjectSnapshots,
  uploadDatasetSnapshot,
  fetchTrainingTimeEstimate,
  createExperiment,
  startExperiment,
  fetchExperimentEvaluation,
  fetchLeaderboard,
  createPipeline,
  validatePipelineConfig,
  fetchProjectPipelines,
} from "../utils/api";

describe("Full Wizard Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset appStore state for fresh integration run
    useAppStore.setState({
      backendPort: 8000,
      authStatus: "authenticated",
      currentStep: "projects",
      currentProjectId: null,
      currentExperimentId: null,
      projects: [],
      isProjectModalOpen: false,
      toast: null,
    });
  });

  it("should step through Projects -> Import -> Pipeline -> Model -> Train -> Evaluate -> Export correctly", async () => {
    // ----------------------------------------------------
    // Mock data
    // ----------------------------------------------------
    const mockProjList = [
      {
        id: "proj-123",
        name: "Customer Churn Classifier",
        taskType: "classification" as const,
        experimentCount: 2,
        updatedAt: "2026-06-29T11:00:00Z",
      },
    ];

    const mockStats = {
      totalExperiments: 2,
      totalExports: 1,
      totalSnapshots: 1,
    };

    const mockSnapshots = [
      {
        id: "snap-1",
        version_label: "Snapshot v1",
        file_name: "churn.csv",
        file_size_bytes: 5120,
        row_count: 100,
        col_count: 6,
        created_at: "2026-06-29T11:05:00Z",
      },
    ];

    const mockUploadedSnapshot = {
      id: "snap-2",
      version_label: "Snapshot v2",
      file_name: "new_churn.csv",
      file_size_bytes: 4096,
      row_count: 150,
      col_count: 6,
      schema: [
        { name: "age", type: "integer", is_target: false, is_ignored: false },
        { name: "tenure", type: "integer", is_target: false, is_ignored: false },
        { name: "churn", type: "integer", is_target: true, is_ignored: false },
      ],
      checksum_sha256: "hash456",
      created_at: "2026-06-29T11:10:00Z",
    };

    const mockTimeEstimate = {
      estimated_seconds: 15,
      requires_gpu: false,
    };

    const mockCreatedExperiment = {
      id: "exp-789",
      project_id: "proj-123",
      status: "pending",
    };

    const mockEvaluation = {
      best_run_id: "run-abc",
      best_model_type: "Random Forest",
      metrics: { f1: 0.892, auc_roc: 0.923, precision: 0.885, recall: 0.901 },
      confusion_matrix: { tn: 45, fp: 5, fn: 4, tp: 46 },
      threshold: 0.5,
      subgroup_analyses: [],
    };

    const mockLeaderboard = [
      {
        experiment_id: "exp-789",
        experiment_id_human: "EXP-001",
        best_model_type: "Random Forest",
        metrics: { f1: 0.892, auc_roc: 0.923, precision: 0.885, recall: 0.901 },
        training_time_seconds: 15,
        is_best: true,
      },
    ];

    // Mock API implementations for this specific test
    vi.mocked(fetchProjects as any).mockResolvedValue(mockProjList as any);
    vi.mocked(fetchDashboardStats as any).mockResolvedValue(mockStats as any);
    vi.mocked(fetchProjectSnapshots as any).mockResolvedValue(mockSnapshots as any);
    vi.mocked(uploadDatasetSnapshot as any).mockResolvedValue({ snapshot: mockUploadedSnapshot } as any);
    vi.mocked(fetchTrainingTimeEstimate as any).mockResolvedValue(mockTimeEstimate as any);
    vi.mocked(createExperiment as any).mockResolvedValue(mockCreatedExperiment as any);
    vi.mocked(startExperiment as any).mockResolvedValue({ success: true } as any);
    vi.mocked(fetchExperimentEvaluation as any).mockResolvedValue(mockEvaluation as any);
    vi.mocked(fetchLeaderboard as any).mockResolvedValue(mockLeaderboard as any);
    vi.mocked(createPipeline as any).mockResolvedValue({ id: "pipe-1", blocks: [] } as any);
    vi.mocked(validatePipelineConfig as any).mockResolvedValue({ valid: true, errors: [], warnings: [] } as any);
    vi.mocked(fetchProjectPipelines as any).mockResolvedValue([] as any);

    // Also populate store projects
    useAppStore.setState({ projects: mockProjList });

    // 1. STEP 1: Projects Dashboard
    render(<AppShell />);

    // Check dashboard header and loaded project
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
      expect(screen.getByText("Customer Churn Classifier")).toBeInTheDocument();
    });

    // Check Sidebar: Import (number 1) should be disabled initially
    const importBtn = screen.getByRole("menuitem", { name: "Import" });
    expect(importBtn).toBeDisabled();

    // Select the project
    const openBtn = screen.getByRole("button", { name: "Open project Customer Churn Classifier" });
    await userEvent.click(openBtn);

    // After selection, currentStep should change to "dataset"
    expect(useAppStore.getState().currentProjectId).toBe("proj-123");
    expect(useAppStore.getState().currentStep).toBe("dataset");

    // 2. STEP 2: Dataset Import
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Dataset Import" })).toBeInTheDocument();
      expect(screen.getByText("Snapshot History")).toBeInTheDocument();
    });

    // Expand Snapshot History panel
    const snapshotHistoryBtn = screen.getByText("Snapshot History");
    await userEvent.click(snapshotHistoryBtn);

    // Verify Snapshot v1 is displayed in the list
    await waitFor(() => {
      expect(screen.getByText("Snapshot v1")).toBeInTheDocument();
    });

    // Sidebar: Import step should now be active, and Pipeline (number 2) disabled
    const pipelineBtn = screen.getByRole("menuitem", { name: "Pipeline" });
    expect(pipelineBtn).toBeDisabled();

    // Trigger dataset complete by simulating a file drop
    const dropZone = screen.getByLabelText("File drop zone");
    const file = new File(["col1,col2,col3\n1,2,3"], "customer_churn.csv", { type: "text/csv" });

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
      },
    });

    // Next step in wizard flow isPreprocessing
    await waitFor(() => {
      expect(useAppStore.getState().currentStep).toBe("preprocessing");
    });

    // 3. STEP 3: Preprocessing Pipeline Builder
    await waitFor(() => {
      expect(screen.getByText("Pipeline Builder")).toBeInTheDocument();
    });

    // Model (number 3) is disabled initially because pipeline is not saved
    const modelBtn = screen.getByRole("menuitem", { name: "Model" });
    expect(modelBtn).toBeDisabled();

    // Add a block to the pipeline
    const addBlockBtn = screen.getByRole("button", { name: "Add Drop Nulls block" });
    await userEvent.click(addBlockBtn);

    // Save pipeline to enable Next button inside Preprocessing screen
    const savePipelineBtn = screen.getByRole("button", { name: "Save Pipeline" });
    await userEvent.click(savePipelineBtn);

    // Wait for Saved state and "Next →" button to render
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Next →" })).toBeInTheDocument();
    });

    // Click "Next →" to navigate to model selection
    const nextBtn = screen.getByRole("button", { name: "Next →" });
    await userEvent.click(nextBtn);

    expect(useAppStore.getState().currentStep).toBe("model");

    // 4. STEP 4: Model Selection
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Model Selection" })).toBeInTheDocument();
    });

    // Train (number 4) should be disabled until an experiment starts
    const trainBtn = screen.getByRole("menuitem", { name: "Train" });
    expect(trainBtn).toBeDisabled();

    // Click "Start Training" to trigger model creation & training transition
    const startTrainingBtn = screen.getByRole("button", { name: "Start Training" });
    await userEvent.click(startTrainingBtn);

    // Verify experiment was created and training started
    await waitFor(() => {
      expect(createExperiment).toHaveBeenCalled();
      expect(startExperiment).toHaveBeenCalledWith("exp-789");
      expect(useAppStore.getState().currentExperimentId).toBe("exp-789");
      expect(useAppStore.getState().currentStep).toBe("training");
    });

    // 5. STEP 5: Training Progress
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Training Progress" })).toBeInTheDocument();
    });

    // Evaluation (number 5) should be disabled until training completes
    const evaluateBtn = screen.getByRole("menuitem", { name: "Evaluate" });
    expect(evaluateBtn).toBeDisabled();

    // Simulate training completion via store / UI triggers
    act(() => {
      useAppStore.getState().setCurrentStep("evaluation");
    });
    expect(useAppStore.getState().currentStep).toBe("evaluation");

    // 6. STEP 6: Evaluation
    await waitFor(() => {
      expect(screen.getByText("Review model performance metrics and analysis.")).toBeInTheDocument();
    });

    // Transition to leaderboard via store
    act(() => {
      useAppStore.getState().setCurrentStep("leaderboard");
    });

    // Leaderboard (number 6) should now be clickable in Sidebar
    await waitFor(() => {
      const leaderboardBtn = screen.getByRole("menuitem", { name: "Leaderboard" });
      expect(leaderboardBtn).toBeEnabled();
    });

    // 7. STEP 7: Leaderboard
    await waitFor(() => {
      expect(screen.getByText("EXP-001")).toBeInTheDocument();
    });

    // Transition to export via store
    act(() => {
      useAppStore.getState().setCurrentStep("export");
    });

    // Export (number 7) is clickable
    await waitFor(() => {
      const exportBtn = screen.getByRole("menuitem", { name: "Export" });
      expect(exportBtn).toBeEnabled();
    });

    // 8. STEP 8: Export Screen
    await waitFor(() => {
      expect(screen.getByText("Export trained models, pipelines, and evaluation artifacts.")).toBeInTheDocument();
    });
  });
});
