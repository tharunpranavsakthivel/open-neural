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
import { fetchProjects } from "../utils/api";
import type { Project } from "../stores/appStore";

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
export function ModelSelection({ projectId }: ModelSelectionProps): JSX.Element {
  /** AutoML mode state - defaults to enabled */
  const [isAutoMLEnabled, setIsAutoMLEnabled] = useState(true);

  /** Project task type */
  const [taskType, setTaskType] = useState<Project["taskType"] | null>(null);

  /** Selected model keys for manual mode */
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());

  /** Loading state for fetching project */
  const [isLoading, setIsLoading] = useState(true);

  /** Error state */
  const [error, setError] = useState<string | null>(null);

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
   * Get available models based on task type.
   */
  const availableModels =
    taskType === "regression" ? REGRESSION_MODELS : CLASSIFICATION_MODELS;

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
      </div>

      {/* Optimization Settings Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Optimization Settings</h2>
        <div style={styles.settingsGrid}>
          <div style={styles.setting}>
            <label style={styles.settingLabel}>Optimization Metric</label>
            <select style={styles.select} defaultValue="f1">
              <option value="f1">F1 Score</option>
              <option value="auc_roc">AUC-ROC</option>
              <option value="precision">Precision</option>
              <option value="recall">Recall</option>
            </select>
          </div>
          <div style={styles.setting}>
            <label style={styles.settingLabel}>Max Trials</label>
            <input
              type="number"
              defaultValue={25}
              style={styles.input}
              min={1}
              max={100}
            />
          </div>
          <div style={styles.setting}>
            <label style={styles.settingLabel}>CV Folds</label>
            <input
              type="number"
              defaultValue={5}
              style={styles.input}
              min={2}
              max={10}
            />
          </div>
          <div style={styles.setting}>
            <label style={styles.settingLabel}>Time Budget (min)</label>
            <input
              type="number"
              defaultValue={8}
              style={styles.input}
              min={1}
              max={60}
            />
          </div>
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
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "1rem",
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
};
