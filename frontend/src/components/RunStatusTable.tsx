/**
 * RunStatusTable component - Displays per-model training status.
 *
 * Renders a table with one row per candidate model showing:
 * - Model Name (user-friendly display name)
 * - Status (Queued/Training/Done/Failed) with color-coded badges
 * - Metric values (F1, AUC-ROC, Precision, Recall for classification;
 *   RMSE, MAE, R² for regression)
 *
 * The "Training" status row includes a pulsing animation indicator.
 * Metric values populate dynamically as each run completes.
 *
 * @module components/RunStatusTable
 */
import { useMemo } from "react";
import type { RunStatusEntry, RunMetrics } from "../stores/trainingStore";

/**
 * Model registry entry mapping a model key to its display label.
 */
interface ModelRegistryEntry {
  /** Backend model registry key */
  key: string;
  /** User-friendly display label */
  label: string;
}

/** Classification models with display labels */
const CLASSIFICATION_MODELS: ModelRegistryEntry[] = [
  { key: "logistic_regression", label: "Logistic Regression" },
  { key: "random_forest", label: "Random Forest" },
  { key: "gradient_boosting", label: "Gradient Boosting" },
  { key: "xgboost", label: "XGBoost" },
  { key: "svm", label: "Support Vector Machine" },
  { key: "knn", label: "k-Nearest Neighbors" },
];

/** Regression models with display labels */
const REGRESSION_MODELS: ModelRegistryEntry[] = [
  { key: "ridge_regression", label: "Ridge Regression" },
  { key: "random_forest_regressor", label: "Random Forest Regressor" },
  { key: "gradient_boosting_regressor", label: "Gradient Boosting Regressor" },
  { key: "xgboost_regressor", label: "XGBoost Regressor" },
  { key: "svr", label: "Support Vector Regressor" },
  { key: "knn_regressor", label: "k-Nearest Neighbors Regressor" },
];

/**
 * Props for the RunStatusTable component.
 */
interface RunStatusTableProps {
  /** Array of run status entries from the training store */
  runs: RunStatusEntry[];
  /** Task type to determine which metrics to display */
  taskType?: "classification" | "regression";
}

/**
 * Get the display label for a model type.
 *
 * @param modelKey - The backend model registry key
 * @returns User-friendly display label
 */
function getModelLabel(modelKey: string): string {
  const allModels = [...CLASSIFICATION_MODELS, ...REGRESSION_MODELS];
  const model = allModels.find((m) => m.key === modelKey);
  return model?.label || modelKey;
}

/**
 * Format a metric value for display.
 *
 * @param value - The metric value
 * @returns Formatted string with 4 decimal places
 */
function formatMetric(value: number | undefined): string {
  if (value === undefined || value === null) {
    return "—";
  }
  return value.toFixed(4);
}

/**
 * Run status table component.
 *
 * Displays a table of model training statuses with real-time updates.
 * Each row shows the model name, current status (with visual badge),
 * and metric values that populate as training completes.
 *
 * @param props - Component props
 * @returns The run status table
 */
export function RunStatusTable({
  runs,
  taskType = "classification",
}: RunStatusTableProps): JSX.Element {
  /**
   * Sort runs to show running items first, then queued, then done/failed.
   */
  const sortedRuns = useMemo(() => {
    const statusPriority: Record<string, number> = {
      running: 0,
      queued: 1,
      done: 2,
      failed: 3,
    };

    return [...runs].sort((a, b) => {
      const priorityDiff =
        (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
      if (priorityDiff !== 0) return priorityDiff;
      // Secondary sort by model name
      return getModelLabel(a.model_type).localeCompare(
        getModelLabel(b.model_type),
      );
    });
  }, [runs]);

  /**
   * Get status badge style based on run status.
   */
  const getStatusBadgeStyle = (
    status: RunStatusEntry["status"],
  ): React.CSSProperties => {
    switch (status) {
      case "running":
        return styles.statusBadgeRunning;
      case "done":
        return styles.statusBadgeDone;
      case "failed":
        return styles.statusBadgeFailed;
      case "queued":
      default:
        return styles.statusBadgeQueued;
    }
  };

  /**
   * Get status display text.
   */
  const getStatusText = (status: RunStatusEntry["status"]): string => {
    switch (status) {
      case "running":
        return "Training";
      case "done":
        return "Done";
      case "failed":
        return "Failed";
      case "queued":
      default:
        return "Queued";
    }
  };

  /**
   * Get primary metric key based on task type.
   */
  const getPrimaryMetric = (metrics?: RunMetrics): number | undefined => {
    if (!metrics) return undefined;
    if (taskType === "regression") {
      return metrics.rmse ?? metrics.mae ?? metrics.r2;
    }
    return metrics.f1 ?? metrics.auc_roc ?? metrics.precision ?? metrics.recall;
  };

  /**
   * Get secondary metric key based on task type.
   */
  const getSecondaryMetric = (metrics?: RunMetrics): number | undefined => {
    if (!metrics) return undefined;
    if (taskType === "regression") {
      return metrics.mae ?? metrics.r2 ?? metrics.rmse;
    }
    return metrics.auc_roc ?? metrics.precision ?? metrics.recall ?? metrics.f1;
  };

  /**
   * Get primary metric label.
   */
  const getPrimaryMetricLabel = (): string => {
    return taskType === "regression" ? "RMSE" : "F1";
  };

  /**
   * Get secondary metric label.
   */
  const getSecondaryMetricLabel = (): string => {
    return taskType === "regression" ? "MAE" : "AUC-ROC";
  };

  if (runs.length === 0) {
    return (
      <div style={styles.emptyState}>
        <p style={styles.emptyText}>No models configured for training.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        <thead>
          <tr style={styles.tableHeaderRow}>
            <th style={{ ...styles.tableHeader, ...styles.colModel }}>Model</th>
            <th style={{ ...styles.tableHeader, ...styles.colStatus }}>
              Status
            </th>
            <th style={{ ...styles.tableHeader, ...styles.colMetric }}>
              {getPrimaryMetricLabel()}
            </th>
            <th style={{ ...styles.tableHeader, ...styles.colMetric }}>
              {getSecondaryMetricLabel()}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRuns.map((run) => {
            const isRunning = run.status === "running";
            const primaryMetric = getPrimaryMetric(run.metrics);
            const secondaryMetric = getSecondaryMetric(run.metrics);

            return (
              <tr
                key={run.model_type}
                style={{
                  ...styles.tableRow,
                  ...(isRunning ? styles.tableRowActive : {}),
                }}
              >
                <td style={{ ...styles.tableCell, ...styles.colModel }}>
                  <span style={styles.modelName}>
                    {getModelLabel(run.model_type)}
                  </span>
                </td>
                <td style={{ ...styles.tableCell, ...styles.colStatus }}>
                  <div style={styles.statusCell}>
                    {isRunning && (
                      <span style={styles.pulseIndicator} aria-hidden="true" />
                    )}
                    <span
                      style={{
                        ...styles.statusBadge,
                        ...getStatusBadgeStyle(run.status),
                      }}
                    >
                      {getStatusText(run.status)}
                    </span>
                  </div>
                </td>
                <td
                  style={{
                    ...styles.tableCell,
                    ...styles.colMetric,
                    ...(primaryMetric !== undefined
                      ? styles.metricValuePopulated
                      : styles.metricValueEmpty),
                  }}
                >
                  {formatMetric(primaryMetric)}
                </td>
                <td
                  style={{
                    ...styles.tableCell,
                    ...styles.colMetric,
                    ...(secondaryMetric !== undefined
                      ? styles.metricValuePopulated
                      : styles.metricValueEmpty),
                  }}
                >
                  {formatMetric(secondaryMetric)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.875rem",
  },
  tableHeaderRow: {
    backgroundColor: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
  },
  tableHeader: {
    padding: "0.75rem 1rem",
    textAlign: "left",
    fontWeight: 600,
    color: "#374151",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  tableRow: {
    borderBottom: "1px solid #e5e7eb",
    transition: "background-color 0.15s ease",
  },
  tableRowActive: {
    backgroundColor: "#eff6ff",
  },
  tableCell: {
    padding: "1rem",
    verticalAlign: "middle",
  },
  colModel: {
    width: "40%",
  },
  colStatus: {
    width: "25%",
  },
  colMetric: {
    width: "17.5%",
    textAlign: "right",
  },
  modelName: {
    fontWeight: 500,
    color: "#111827",
  },
  statusCell: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  pulseIndicator: {
    width: "8px",
    height: "8px",
    backgroundColor: "#2563eb",
    borderRadius: "50%",
    animation: "pulse-dot 1.5s ease-in-out infinite",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.25rem 0.75rem",
    borderRadius: "9999px",
    fontSize: "0.75rem",
    fontWeight: 500,
    textTransform: "capitalize",
  },
  statusBadgeQueued: {
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
  },
  statusBadgeRunning: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
  },
  statusBadgeDone: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  statusBadgeFailed: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  metricValuePopulated: {
    color: "#111827",
    fontWeight: 500,
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  metricValueEmpty: {
    color: "#9ca3af",
  },
  emptyState: {
    padding: "2rem",
    textAlign: "center",
    color: "#6b7280",
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    border: "1px dashed #e5e7eb",
  },
  emptyText: {
    margin: 0,
    fontSize: "0.875rem",
  },
};
