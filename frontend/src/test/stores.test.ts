import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "../stores/appStore";
import { useDatasetStore } from "../stores/datasetStore";
import { useEvaluationStore } from "../stores/evaluationStore";
import { usePipelineStore } from "../stores/pipelineStore";
import { useTrainingStore } from "../stores/trainingStore";
import { useWizardStore } from "../stores/wizardStore";

describe("Zustand Stores Unit Tests", () => {
  // Reset stores to initial state before each test
  beforeEach(() => {
    useAppStore.setState({
      backendPort: null,
      authStatus: "setup",
      currentProjectId: null,
      backendSecret: null,
    });

    useDatasetStore.setState({
      currentSnapshot: null,
      snapshotHistory: [],
      uploadProgress: 0,
    });

    useEvaluationStore.setState({
      evaluation: null,
      selectedThreshold: 0.5,
    });

    usePipelineStore.setState({
      blocks: [],
      validationResult: null,
      savedPipelineId: null,
    });

    useTrainingStore.setState({
      experimentId: null,
      status: "created",
      progressPct: 0,
      cpuPct: 0,
      ramUsedGb: 0,
      ramTotalGb: 0,
      runs: [],
      isConnected: false,
      error: null,
    });

    useWizardStore.setState({
      activeStep: "projects",
      completedSteps: new Set(),
      unsavedConfig: {},
    });
  });

  describe("useAppStore", () => {
    it("should have correct initial values", () => {
      const state = useAppStore.getState();
      expect(state.backendPort).toBeNull();
      expect(state.authStatus).toBe("setup");
      expect(state.currentProjectId).toBeNull();
      expect(state.backendSecret).toBeNull();
    });

    it("should update backendPort when setBackendPort is called", () => {
      useAppStore.getState().setBackendPort(8080);
      expect(useAppStore.getState().backendPort).toBe(8080);
    });

    it("should update authStatus when setAuthStatus is called", () => {
      useAppStore.getState().setAuthStatus("authenticated");
      expect(useAppStore.getState().authStatus).toBe("authenticated");
    });

    it("should update currentProjectId when setCurrentProject is called", () => {
      useAppStore.getState().setCurrentProject("proj-123");
      expect(useAppStore.getState().currentProjectId).toBe("proj-123");
    });

    it("should update backendSecret when setBackendSecret is called", () => {
      useAppStore.getState().setBackendSecret("new-secret-456");
      expect(useAppStore.getState().backendSecret).toBe("new-secret-456");
    });

    it("should update backendPort and backendSecret together", () => {
      useAppStore.getState().setBackendConfig(57572, "runtime-secret");
      expect(useAppStore.getState().backendPort).toBe(57572);
      expect(useAppStore.getState().backendSecret).toBe("runtime-secret");
    });
  });

  describe("useDatasetStore", () => {
    const mockSnapshot = {
      id: "snap-123",
      version_label: "Snapshot v1",
      file_name: "churn.csv",
      file_size_bytes: 5000,
      row_count: 100,
      col_count: 5,
      schema: [],
      checksum_sha256: "hash123",
      created_at: "2026-06-29T11:00:00Z",
    };

    it("should have correct initial values", () => {
      const state = useDatasetStore.getState();
      expect(state.currentSnapshot).toBeNull();
      expect(state.snapshotHistory).toEqual([]);
      expect(state.uploadProgress).toBe(0);
    });

    it("should update snapshot when setSnapshot is called", () => {
      useDatasetStore.getState().setSnapshot(mockSnapshot);
      expect(useDatasetStore.getState().currentSnapshot).toEqual(mockSnapshot);
    });

    it("should update history when setSnapshotHistory is called", () => {
      const historyItem = {
        id: "snap-123",
        version_label: "Snapshot v1",
        row_count: 100,
        created_at: "2026-06-29T11:00:00Z",
      };
      useDatasetStore.getState().setSnapshotHistory([historyItem]);
      expect(useDatasetStore.getState().snapshotHistory).toEqual([historyItem]);
    });

    it("should update upload progress when setUploadProgress is called", () => {
      useDatasetStore.getState().setUploadProgress(75);
      expect(useDatasetStore.getState().uploadProgress).toBe(75);
    });

    it("should clear dataset state on clearDatasetState", () => {
      useDatasetStore.getState().setSnapshot(mockSnapshot);
      useDatasetStore.getState().clearDatasetState();
      expect(useDatasetStore.getState().currentSnapshot).toBeNull();
      expect(useDatasetStore.getState().snapshotHistory).toEqual([]);
    });
  });

  describe("useEvaluationStore", () => {
    it("should have correct initial values", () => {
      const state = useEvaluationStore.getState();
      expect(state.evaluation).toBeNull();
      expect(state.selectedThreshold).toBe(0.5);
    });

    it("should set evaluation and default threshold", () => {
      const mockEval = {
        best_run_id: "run-123",
        best_model_type: "xgboost",
        metrics: { f1: 0.85, auc_roc: 0.9, precision: 0.8, recall: 0.9 },
        confusion_matrix: { tn: 10, fp: 2, fn: 1, tp: 12 },
        threshold: 0.45,
        subgroup_analyses: [],
      };
      useEvaluationStore.getState().setEvaluation(mockEval);
      expect(useEvaluationStore.getState().evaluation).toEqual(mockEval);
      expect(useEvaluationStore.getState().selectedThreshold).toBe(0.45);
    });

    it("should update threshold when setThreshold is called", () => {
      useEvaluationStore.getState().setThreshold(0.7);
      expect(useEvaluationStore.getState().selectedThreshold).toBe(0.7);
    });

    it("should update threshold metrics when updateThresholdMetrics is called", () => {
      const mockEval = {
        best_run_id: "run-123",
        best_model_type: "xgboost",
        metrics: { f1: 0.85, auc_roc: 0.9, precision: 0.8, recall: 0.9 },
        confusion_matrix: { tn: 10, fp: 2, fn: 1, tp: 12 },
        threshold: 0.45,
        subgroup_analyses: [],
      };
      useEvaluationStore.getState().setEvaluation(mockEval);
      useEvaluationStore.getState().updateThresholdMetrics({
        precision: 0.82,
        recall: 0.88,
        f1: 0.85,
      });
      expect(useEvaluationStore.getState().evaluation?.metrics).toEqual({
        f1: 0.85,
        auc_roc: 0.9,
        precision: 0.82,
        recall: 0.88,
      });
    });
  });

  describe("usePipelineStore", () => {
    const mockBlock = {
      id: "block-1",
      type: "drop_nulls" as const,
      name: "Drop Nulls",
      description: "Remove rows with nulls",
      status: "configured" as const,
      params: {},
    };

    it("should have correct initial values", () => {
      const state = usePipelineStore.getState();
      expect(state.blocks).toEqual([]);
      expect(state.validationResult).toBeNull();
      expect(state.savedPipelineId).toBeNull();
    });

    it("should add a block when addBlock is called", () => {
      usePipelineStore.getState().addBlock(mockBlock);
      expect(usePipelineStore.getState().blocks).toEqual([mockBlock]);
    });

    it("should remove a block when removeBlock is called", () => {
      usePipelineStore.getState().addBlock(mockBlock);
      usePipelineStore.getState().removeBlock("block-1");
      expect(usePipelineStore.getState().blocks).toEqual([]);
    });

    it("should update block params when updateBlockParams is called", () => {
      usePipelineStore.getState().addBlock(mockBlock);
      usePipelineStore.getState().updateBlockParams("block-1", { foo: "bar" });
      expect(usePipelineStore.getState().blocks[0]!.params).toEqual({
        foo: "bar",
      });
    });
  });

  describe("useTrainingStore", () => {
    it("should have correct initial values", () => {
      const state = useTrainingStore.getState();
      expect(state.experimentId).toBeNull();
      expect(state.status).toBe("created");
      expect(state.progressPct).toBe(0);
      expect(state.runs).toEqual([]);
    });

    it("should update state on updateFromSSE", () => {
      const mockUpdate = {
        status: "running" as const,
        progress_pct: 45,
        cpu_pct: 12,
        ram_used_gb: 4,
        ram_total_gb: 16,
        runs: [],
      };
      useTrainingStore.getState().updateFromSSE(mockUpdate);
      expect(useTrainingStore.getState().status).toBe("running");
      expect(useTrainingStore.getState().progressPct).toBe(45);
      expect(useTrainingStore.getState().cpuPct).toBe(12);
    });
  });

  describe("useWizardStore", () => {
    it("should have correct initial values", () => {
      const state = useWizardStore.getState();
      expect(state.activeStep).toBe("projects");
      expect(state.completedSteps).toBeInstanceOf(Set);
      expect(state.completedSteps.size).toBe(0);
    });

    it("should allow navigating to projects initially", () => {
      const success = useWizardStore.getState().navigateToStep("projects");
      expect(success).toBe(true);
      expect(useWizardStore.getState().activeStep).toBe("projects");
    });

    it("should block navigation to uncompleted steps", () => {
      // Trying to jump to dataset when projects is not complete should fail
      const success = useWizardStore.getState().navigateToStep("preprocessing");
      expect(success).toBe(false);
      expect(useWizardStore.getState().activeStep).toBe("projects");
    });

    it("should allow navigation to the immediate next step if the current step is active", () => {
      // Active step is projects. Target is dataset. Index of projects is 0, dataset is 1.
      // Even if not completed, we can navigate to the immediate next step from active step
      const success = useWizardStore.getState().navigateToStep("dataset");
      expect(success).toBe(true);
      expect(useWizardStore.getState().activeStep).toBe("dataset");
    });

    it("should block navigating further forward", () => {
      // Active step is projects. Target is preprocessing (index 2). This is index + 2, so blocked.
      const success = useWizardStore.getState().navigateToStep("preprocessing");
      expect(success).toBe(false);
    });

    it("should allow navigating to completed steps", () => {
      useWizardStore.getState().markStepComplete("projects");
      useWizardStore.getState().markStepComplete("dataset");

      // Let's go to preprocessing
      let success = useWizardStore.getState().navigateToStep("dataset");
      expect(success).toBe(true);
      success = useWizardStore.getState().navigateToStep("preprocessing");
      expect(success).toBe(true);

      // We should be able to go back to completed steps
      success = useWizardStore.getState().navigateToStep("projects");
      expect(success).toBe(true);
      expect(useWizardStore.getState().activeStep).toBe("projects");
    });

    it("should save and retrieve step config", () => {
      const mockConfig = { file: "test.csv" };
      useWizardStore.getState().saveStepConfig("dataset", mockConfig);
      expect(useWizardStore.getState().getStepConfig("dataset")).toEqual(
        mockConfig,
      );
    });
  });
});
