/**
 * ModelSelection screen - Step 3: Model selection and AutoML configuration.
 *
 * Allows users to select candidate models and configure AutoML parameters.
 * AutoML mode is enabled by default, which pre-selects all models for the
 * current task type and disables individual model selection.
 *
 * Model labels correspond to the backend MODEL_REGISTRY keys but display
 * user-friendly names:
 * - Classification: Logistic Regression, Random Forest, Gradient Boosting, XGBoost,
 *   Support Vector Machine, k-Nearest Neighbors
 * - Regression: Ridge Regression, Random Forest Regressor, Gradient Boosting Regressor,
 *   XGBoost Regressor, Support Vector Regressor, k-Nearest Neighbors Regressor
 *
 * @module screens/ModelSelection
 */
import { useState, useEffect, useCallback } from "react";
import { fetchProjects, fetchTrainingTimeEstimate, createExperiment, startExperiment } from "../utils/api";
import type { Project } from "../stores/appStore";
import type { TrainingTimeEstimateResponse } from "../utils/api";

/**
 * Model registry entry mapping a model key to its display label.
 * Keys correspond to the backend MODEL_REGISTRY.
 */
interface ModelRegistryEntry {
  /** Backend model registry key */
  key: string;
  /** User-friendly display label */
  label: string;
}

/** Classification models from MODEL_REGISTRY with display labels */
const CLASSIFICATION_MODELS: ModelRegistryEntry[] = [
  { key: "logistic_regression", label: "Logistic Regression" },
  { key: "random_forest", label: "Random Forest" },
  { key: "gradient_boosting", label: "Gradient Boosting" },
  { key: "xgboost", label: "XGBoost" },
  { key: "svm", label: "Support Vector Machine" },
  { key: "knn", label: "k-Nearest Neighbors" },
];

/** Regression models from MODEL_REGISTRY with display labels */
const REGRESSION_MODELS: ModelRegistryEntry[] = [
  { key: "ridge_regression", label: "Ridge Regression" },
  { key: "random_forest_regressor", label: "Random Forest Regressor" },
  { key: "gradient_boosting_regressor", label: "Gradient Boosting Regressor" },
  { key: "xgboost_regressor", label: "XGBoost Regressor" },
  { key: "svr", label: "Support Vector Regressor" },
  { key: "knn_regressor", label: "k-Nearest Neighbors Regressor" },
];

interface ModelSelectionProps {
  /** Currently selected project ID */
  projectId: string;
  /** Currently selected pipeline ID (needed for time estimation and training) */
  pipelineId?: string;
  /**
   * Callback when training starts with the experiment ID.
   * Called after experiment is created and training is initiated.
   */
  onStartTraining?: (experimentId: string) => void;
}

/**
 * Model selection wizard step component.
 *
 * Renders a checklist of candidate models from MODEL_REGISTRY filtered by
 * project task type. Each model is displayed with its user-friendly label.
 *
 * @param props - Component props
 * @returns The model selection screen
 */
export function ModelSelection({
  projectId,
  pipelineId,
  onStartTraining,
}: ModelSelectionProps): JSX.Element {
  /** AutoML mode state - defaults to enabled */
  const [isAutoMLEnabled, setIsAutoMLEnabled] = useState(true);

  /** Project task type */
  const [taskType, setTaskType] = useState<Project["taskType"] | null>(null);

  /** Selected model keys for manual mode */
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());

  /** Selected optimization metric */
  const [optimizationMetric, setOptimizationMetric] = useState<string>("");

  /** Advanced configuration panel expanded state */
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);

  /** Advanced configuration values */
  const [maxTrials, setMaxTrials] = useState(25);
  const [cvFolds, setCvFolds] = useState(5);
  const [timeBudget, setTimeBudget] = useState(8);

  /** Loading state for fetching project */
  const [isLoading, setIsLoading] = useState(true);

  /** Error state */
  const [error, setError] = useState<string | null>(null);

  /**
   * Tooltip state for showing/hiding tooltips.
   */
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  /** Training time estimate */
  const [timeEstimate, setTimeEstimate] =
    useState<TrainingTimeEstimateResponse | null>(null);

  /** Loading state for time estimate */
  const [isEstimating, setIsEstimating] = useState(false);

  /** Time estimate error */
  const [estimateError, setEstimateError] = useState<string | null>(null);

  /** Training submission state */
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Training submission error */
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Classification metrics with F1 as default.
   */
  const CLASSIFICATION_METRICS = [
    { value: "f1", label: "F1" },
    { value: "auc_roc", label: "AUC-ROC" },
    { value: "precision", label: "Precision" },
    { value: "recall", label: "Recall" },
  ];

  /**
   * Regression metrics with RMSE as default.
   */
  const REGRESSION_METRICS = [
    { value: "rmse", label: "RMSE" },
    { value: "mae", label: "MAE" },
    { value: "r2", label: "R²" },
  ];

  /**
   * Fetch project to determine task type.
   */
  useEffect(() => {
    const loadProject = async (): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        const projects = await fetchProjects();
        const project = projects.find((p) => p.id === projectId);

        if (project) {
          setTaskType(project.taskType);
          // Set default optimization metric based on task type
          setOptimizationMetric(
            project.taskType === "regression" ? "rmse" : "f1"
          );
          // Pre-select all models for the task type in AutoML mode
          const allModelKeys =
            project.taskType === "regression"
              ? REGRESSION_MODELS.map((m) => m.key)
              : CLASSIFICATION_MODELS.map((m) => m.key);
          setSelectedModels(new Set(allModelKeys));
        } else {
          setError("Project not found");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load project";
        setError(errorMessage);
        console.error("Project load failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  /**
   * Fetch training time estimate when configuration changes.
   */
  useEffect(() => {
    const fetchEstimate = async (): Promise<void> => {
      // Only fetch if we have a pipeline ID and models are selected
      if (!pipelineId || selectedModels.size === 0) {
        setTimeEstimate(null);
        return;
      }

      try {
        setIsEstimating(true);
        setEstimateError(null);

        const estimate = await fetchTrainingTimeEstimate({
          pipeline_id: pipelineId,
          candidate_models: Array.from(selectedModels),
          max_trials: maxTrials,
          cv_folds: cvFolds,
        });

        setTimeEstimate(estimate);
      } catch (err) {
        // Silently fail - time estimate is advisory, not critical
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch time estimate";
        setEstimateError(errorMessage);
        console.error("Time estimate fetch failed:", err);
      } finally {
        setIsEstimating(false);
      }
    };

    // Debounce the estimate fetch to avoid excessive API calls
    const timeoutId = setTimeout(() => {
      fetchEstimate();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [pipelineId, selectedModels, maxTrials, cvFolds]);

  /**
   * Get available models based on task type.
   */
  const availableModels =
    taskType === "regression" ? REGRESSION_MODELS : CLASSIFICATION_MODELS;

  /**
   * Get available metrics based on task type.
   */
  const availableMetrics =
    taskType === "regression" ? REGRESSION_METRICS : CLASSIFICATION_METRICS;

  /**
   * Handle metric selection change.
   */
  const handleMetricChange = useCallback((metric: string) => {
    setOptimizationMetric(metric);
  }, []);

  /**
   * Toggle advanced configuration panel.
   */
  const handleToggleAdvanced = useCallback(() => {
    setIsAdvancedExpanded((prev) => !prev);
  }, []);

  /**
   * Show tooltip for a setting.
   */
  const showTooltip = useCallback((tooltipId: string) => {
    setActiveTooltip(tooltipId);
  }, []);

  /**
   * Hide tooltip.
   */
  const hideTooltip = useCallback(() => {
    setActiveTooltip(null);
  }, []);

  /**
   * Toggle AutoML mode.
   */
  const handleAutoMLToggle = useCallback(() => {
    setIsAutoMLEnabled((prev) => {
      const newValue = !prev;
      // When enabling AutoML, select all models
      if (newValue) {
        setSelectedModels(new Set(availableModels.map((m) => m.key)));
      }
      return newValue;
    });
  }, [availableModels]);

  /**
   * Toggle individual model selection.
   */
  const handleModelToggle = useCallback(
    (modelKey: string) => {
      if (isAutoMLEnabled) return; // Disabled in AutoML mode

      setSelectedModels((prev) => {
        const next = new Set(prev);
        if (next.has(modelKey)) {
          next.delete(modelKey);
        } else {
          next.add(modelKey);
        }
        return next;
      });
    },
    [isAutoMLEnabled]
  );

  /**
   * Select all models in manual mode.
   */
  const handleSelectAll = useCallback(() => {
    if (isAutoMLEnabled) return;
    setSelectedModels(new Set(availableModels.map((m) => m.key)));
  }, [isAutoMLEnabled, availableModels]);

  /**
   * Deselect all models in manual mode.
   */
  const handleDeselectAll = useCallback(() => {
    if (isAutoMLEnabled) return;
    setSelectedModels(new Set());
  }, [isAutoMLEnabled]);

  /**
   * Start training handler.
   */
  const handleStartTraining = useCallback(async () => {
    if (!pipelineId) {
      setSubmitError("No pipeline selected. Please configure a preprocessing pipeline first.");
      return;
    }

    if (selectedModels.size === 0) {
      setSubmitError("Please select at least one model to train.");
      return;
    }

    if (!optimizationMetric) {
      setSubmitError("Please select an optimization metric.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      // Step 1: Create experiment
      const experiment = await createExperiment(projectId, {
        pipeline_id: pipelineId,
        automl_enabled: isAutoMLEnabled,
        optimize_metric: optimizationMetric,
        automl_config: {
          max_trials: maxTrials,
          cv_folds: cvFolds,
          time_budget_minutes: timeBudget,
        },
        candidate_models: Array.from(selectedModels),
      });

      // Step 2: Start training
      await startExperiment(experiment.id);

      // Step 3: Navigate to training step with experiment ID
      if (onStartTraining) {
        onStartTraining(experiment.id);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start training";
      setSubmitError(errorMessage);
      console.error("Training start failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    pipelineId,
    projectId,
    selectedModels,
    isAutoMLEnabled,
    optimizationMetric,
    maxTrials,
    cvFolds,
    timeBudget,
    onStartTraining,
  ]);

  /**
   * Check if training can be started.
   */
  const canStartTraining =
    pipelineId &&
    selectedModels.size > 0 &&
    optimizationMetric &&
    !isSubmitting;

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner} aria-label="Loading" />
          <p style={styles.loadingText}>Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <h2 style={styles.errorTitle}>Failed to load project</h2>
          <p style={styles.errorMessage}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Model Selection</h1>
        <p style={styles.description}>
          Choose which models to train and configure the optimization settings.
        </p>
      </header>

      {/* AutoML Toggle Section */}
      <div style={styles.section}>
        <div style={styles.toggleContainer}>
          <button
            onClick={handleAutoMLToggle}
            style={{
              ...styles.toggleButton,
              ...(isAutoMLEnabled ? styles.toggleActive : {}),
            }}
            aria-pressed={isAutoMLEnabled}
          >
            <span style={styles.toggleLabel}>AutoML (Recommended)</span>
          </button>
          <button
            onClick={handleAutoMLToggle}
            style={{
              ...styles.toggleButton,
              ...(!isAutoMLEnabled ? styles.toggleActive : {}),
            }}
            aria-pressed={!isAutoMLEnabled}
          >
            <span style={styles.toggleLabel}>Manual Selection</span>
          </button>
        </div>
        <p style={styles.toggleDescription}>
          {isAutoMLEnabled
            ? "All candidate models will be automatically selected and optimized."
            : "Select specific models to train from the list below."}
        </p>
      </div>

      {/* Candidate Models Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Candidate Models</h2>
          {!isAutoMLEnabled && (
            <div style={styles.modelActions}>
              <button onClick={handleSelectAll} style={styles.actionLink}>
                Select All
              </button>
              <span style={styles.actionDivider}>|</span>
              <button onClick={handleDeselectAll} style={styles.actionLink}>
                Deselect All
              </button>
            </div>
          )}
        </div>
        <div style={styles.modelGrid}>
          {availableModels.map((model) => (
            <label
              key={model.key}
              style={{
                ...styles.modelCard,
                ...(isAutoMLEnabled ? styles.modelCardDisabled : {}),
                ...(selectedModels.has(model.key)
                  ? styles.modelCardSelected
                  : {}),
              }}
            >
              <input
                type="checkbox"
                checked={selectedModels.has(model.key)}
                disabled={isAutoMLEnabled}
                onChange={() => handleModelToggle(model.key)}
                style={styles.checkbox}
              />
              <span style={styles.modelName}>{model.label}</span>
            </label>
          ))}
        </div>
        {!isAutoMLEnabled && selectedModels.size === 0 && (
          <p style={styles.warningText}>
            Please select at least one model to train.
          </p>
        )}

        {/* Estimated Training Time */}
        {timeEstimate && !estimateError && (
          <div style={styles.estimateContainer}>
            <span style={styles.estimateIcon}>⏱</span>
            <span style={styles.estimateText}>
              Estimated training time: ~{timeEstimate.estimated_minutes} minutes
            </span>
            {timeEstimate.is_advisory && (
              <span style={styles.estimateNote}>(advisory)</span>
            )}
          </div>
        )}
        {isEstimating && (
          <div style={styles.estimateContainer}>
            <span style={styles.estimateIcon}>⏳</span>
            <span style={styles.estimateTextLoading}>
              Calculating estimate...
            </span>
          </div>
        )}
      </div>

      {/* Optimization Settings Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Optimization Settings</h2>
        <div style={styles.settingsGrid}>
          {/* Optimization Metric - Radio Buttons */}
          <div style={{ ...styles.setting, gridColumn: "span 2" }}>
            <label style={styles.settingLabel}>Optimization Metric</label>
            <div style={styles.radioGroup}>
              {availableMetrics.map((metric) => (
                <label key={metric.value} style={styles.radioLabel}>
                  <input
                    type="radio"
                    name="optimizationMetric"
                    value={metric.value}
                    checked={optimizationMetric === metric.value}
                    onChange={() => handleMetricChange(metric.value)}
                    style={styles.radio}
                  />
                  <span style={styles.radioText}>{metric.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Advanced Configuration Toggle */}
        <div style={styles.advancedToggleContainer}>
          <button
            onClick={handleToggleAdvanced}
            style={styles.advancedToggle}
            aria-expanded={isAdvancedExpanded}
          >
            <span style={styles.advancedToggleIcon}>
              {isAdvancedExpanded ? "▼" : "▶"}
            </span>
            <span style={styles.advancedToggleText}>
              Advanced Configuration
            </span>
          </button>
        </div>

        {/* Advanced Configuration Panel */}
        {isAdvancedExpanded && (
          <div style={styles.advancedPanel}>
            <div style={styles.advancedGrid}>
              {/* Max Trials */}
              <div style={styles.advancedSetting}>
                <div style={styles.settingLabelRow}>
                  <label style={styles.settingLabel}>Max AutoML Trials</label>
                  <span
                    style={styles.tooltipIcon}
                    onMouseEnter={() => showTooltip("maxTrials")}
                    onMouseLeave={hideTooltip}
                    onFocus={() => showTooltip("maxTrials")}
                    onBlur={hideTooltip}
                    tabIndex={0}
                    role="button"
                    aria-label="Show tooltip for Max AutoML Trials"
                  >
                    ⓘ
                  </span>
                  {activeTooltip === "maxTrials" && (
                    <div style={styles.tooltip}>
                      Maximum number of hyperparameter combinations to try.
                      Higher values may find better models but take longer.
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  value={maxTrials}
                  onChange={(e) =>
                    setMaxTrials(
                      Math.max(1, Math.min(100, parseInt(e.target.value) || 1))
                    )
                  }
                  style={styles.input}
                  min={1}
                  max={100}
                />
              </div>

              {/* CV Folds */}
              <div style={styles.advancedSetting}>
                <div style={styles.settingLabelRow}>
                  <label style={styles.settingLabel}>CV Folds</label>
                  <span
                    style={styles.tooltipIcon}
                    onMouseEnter={() => showTooltip("cvFolds")}
                    onMouseLeave={hideTooltip}
                    onFocus={() => showTooltip("cvFolds")}
                    onBlur={hideTooltip}
                    tabIndex={0}
                    role="button"
                    aria-label="Show tooltip for CV Folds"
                  >
                    ⓘ
                  </span>
                  {activeTooltip === "cvFolds" && (
                    <div style={styles.tooltip}>
                      Number of cross-validation folds. More folds give more
                      reliable estimates but increase training time.
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  value={cvFolds}
                  onChange={(e) =>
                    setCvFolds(
                      Math.max(2, Math.min(10, parseInt(e.target.value) || 2))
                    )
                  }
                  style={styles.input}
                  min={2}
                  max={10}
                />
              </div>

              {/* Time Budget */}
              <div style={styles.advancedSetting}>
                <div style={styles.settingLabelRow}>
                  <label style={styles.settingLabel}>Time Budget (minutes)</label>
                  <span
                    style={styles.tooltipIcon}
                    onMouseEnter={() => showTooltip("timeBudget")}
                    onMouseLeave={hideTooltip}
                    onFocus={() => showTooltip("timeBudget")}
                    onBlur={hideTooltip}
                    tabIndex={0}
                    role="button"
                    aria-label="Show tooltip for Time Budget"
                  >
                    ⓘ
                  </span>
                  {activeTooltip === "timeBudget" && (
                    <div style={styles.tooltip}>
                      Maximum time allowed for AutoML search. The search will
                      stop when this limit is reached.
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  value={timeBudget}
                  onChange={(e) =>
                    setTimeBudget(
                      Math.max(1, Math.min(60, parseInt(e.target.value) || 1))
                    )
                  }
                  style={styles.input}
                  min={1}
                  max={60}
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit Error */}
        {submitError && (
          <div style={styles.submitError}>
            <span style={styles.submitErrorIcon}>⚠</span>
            <span style={styles.submitErrorText}>{submitError}</span>
          </div>
        )}

        {/* Start Training Button */}
        <div style={styles.startTrainingContainer}>
          <button
            onClick={handleStartTraining}
            disabled={!canStartTraining}
            style={{
              ...styles.startTrainingButton,
              ...(canStartTraining ? {} : styles.startTrainingButtonDisabled),
            }}
          >
            {isSubmitting ? (
              <>
                <span style={styles.buttonSpinner} />
                Starting...
              </>
            ) : (
              <>Start Training</>
            )}
          </button>
          {!pipelineId && (
            <p style={styles.startTrainingHint}>
              Configure a preprocessing pipeline first to start training.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "2rem",
  },
  header: {
    marginBottom: "2rem",
  },
  title: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#111827",
  },
  description: {
    margin: 0,
    color: "#6b7280",
    fontSize: "0.875rem",
  },
  section: {
    marginBottom: "2rem",
    padding: "1.5rem",
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  toggleContainer: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "0.75rem",
  },
  toggleButton: {
    flex: 1,
    padding: "0.75rem 1rem",
    backgroundColor: "#f3f4f6",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  toggleActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
    color: "#ffffff",
  },
  toggleLabel: {
    fontSize: "0.875rem",
    fontWeight: 500,
  },
  toggleDescription: {
    margin: 0,
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  modelActions: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  actionLink: {
    padding: "0.25rem 0.5rem",
    backgroundColor: "transparent",
    border: "none",
    color: "#2563eb",
    fontSize: "0.75rem",
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "underline",
  },
  actionDivider: {
    color: "#d1d5db",
    fontSize: "0.75rem",
  },
  modelGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "0.75rem",
  },
  modelCard: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.75rem",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  modelCardSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
  },
  modelCardDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  checkbox: {
    width: "1rem",
    height: "1rem",
    cursor: "pointer",
  },
  modelName: {
    fontSize: "0.875rem",
    color: "#374151",
  },
  warningText: {
    margin: "0.75rem 0 0 0",
    fontSize: "0.75rem",
    color: "#dc2626",
  },
  estimateContainer: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginTop: "1rem",
    padding: "0.75rem",
    backgroundColor: "#f0f9ff",
    border: "1px solid #bae6fd",
    borderRadius: "6px",
  },
  estimateIcon: {
    fontSize: "1rem",
  },
  estimateText: {
    fontSize: "0.875rem",
    color: "#0369a1",
    fontWeight: 500,
  },
  estimateTextLoading: {
    fontSize: "0.875rem",
    color: "#6b7280",
  },
  estimateNote: {
    fontSize: "0.75rem",
    color: "#6b7280",
    fontStyle: "italic",
  },
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "1rem",
  },
  radioGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "1rem",
    marginTop: "0.25rem",
  },
  radioLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer",
    padding: "0.5rem 0.75rem",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    transition: "all 0.15s ease",
  },
  radio: {
    width: "1rem",
    height: "1rem",
    cursor: "pointer",
  },
  radioText: {
    fontSize: "0.875rem",
    color: "#374151",
  },
  setting: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  settingLabel: {
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "#374151",
  },
  settingLabelRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    position: "relative",
  },
  tooltipIcon: {
    width: "16px",
    height: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.75rem",
    color: "#9ca3af",
    cursor: "help",
    borderRadius: "50%",
    backgroundColor: "#f3f4f6",
    userSelect: "none",
  },
  tooltip: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: "0.5rem",
    padding: "0.75rem",
    backgroundColor: "#1f2937",
    color: "#ffffff",
    fontSize: "0.75rem",
    borderRadius: "6px",
    maxWidth: "280px",
    zIndex: 10,
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    lineHeight: 1.5,
  },
  advancedToggleContainer: {
    marginTop: "1.5rem",
    paddingTop: "1rem",
    borderTop: "1px solid #e5e7eb",
  },
  advancedToggle: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 0",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#2563eb",
    fontSize: "0.875rem",
    fontWeight: 500,
  },
  advancedToggleIcon: {
    fontSize: "0.75rem",
    transition: "transform 0.15s ease",
  },
  advancedToggleText: {
    textDecoration: "underline",
  },
  advancedPanel: {
    marginTop: "1rem",
    padding: "1rem",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
  },
  advancedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "1rem",
  },
  advancedSetting: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    position: "relative",
  },
  select: {
    padding: "0.5rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    backgroundColor: "#ffffff",
  },
  input: {
    padding: "0.5rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    width: "100%",
    boxSizing: "border-box",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "4rem 2rem",
  },
  loadingSpinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #e5e7eb",
    borderTop: "3px solid #2563eb",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    marginTop: "1rem",
    color: "#6b7280",
    fontSize: "0.875rem",
  },
  errorContainer: {
    textAlign: "center",
    padding: "2rem",
    backgroundColor: "#fef2f2",
    borderRadius: "8px",
    border: "1px solid #fecaca",
  },
  errorTitle: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#dc2626",
  },
  errorMessage: {
    margin: 0,
    color: "#7f1d1d",
    fontSize: "0.875rem",
  },
  submitError: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginTop: "1rem",
    padding: "0.75rem",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "6px",
  },
  submitErrorIcon: {
    fontSize: "1rem",
    color: "#dc2626",
  },
  submitErrorText: {
    fontSize: "0.875rem",
    color: "#dc2626",
  },
  startTrainingContainer: {
    marginTop: "1.5rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.75rem",
  },
  startTrainingButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "1rem 2rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease",
    minWidth: "200px",
  },
  startTrainingButtonDisabled: {
    backgroundColor: "#d1d5db",
    cursor: "not-allowed",
  },
  buttonSpinner: {
    width: "16px",
    height: "16px",
    border: "2px solid rgba(255, 255, 255, 0.3)",
    borderTop: "2px solid #ffffff",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  startTrainingHint: {
    margin: 0,
    fontSize: "0.75rem",
    color: "#6b7280",
    textAlign: "center",
  },
};
