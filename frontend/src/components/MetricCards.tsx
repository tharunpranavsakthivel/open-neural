/**
 * MetricCards component - Displays evaluation metric cards with color-coded values.
 *
 * Renders metric cards for either classification (F1, AUC-ROC, Precision, Recall)
 * or regression (RMSE, MAE, R²) tasks. Each card shows the metric name,
 * numeric value formatted to 4 decimal places, and a subtle color scale
 * indicating performance (green for good, yellow for moderate, red for poor).
 *
 * For regression tasks, includes a toggle for showing/hiding the residual plot.
 *
 * @module components/MetricCards
 */
import { useState } from "react";

/**
 * Classification metrics interface.
 */
export interface ClassificationMetrics {
  /** F1 score (0-1, higher is better) */
  f1: number;
  /** AUC-ROC score (0-1, higher is better) */
  auc_roc: number;
  /** Precision (0-1, higher is better) */
  precision: number;
  /** Recall (0-1, higher is better) */
  recall: number;
}

/**
 * Regression metrics interface.
 */
export interface RegressionMetrics {
  /** Root Mean Square Error (lower is better) */
  rmse: number;
  /** Mean Absolute Error (lower is better) */
  mae: number;
  /** R-squared coefficient (0-1, higher is better) */
  r2: number;
}

/**
 * Props for the MetricCards component.
 */
interface MetricCardsProps {
  /** Task type - determines which metrics to display */
  taskType: "classification" | "regression";
  /** Classification metrics (required when taskType is "classification") */
  classificationMetrics?: ClassificationMetrics;
  /** Regression metrics (required when taskType is "regression") */
  regressionMetrics?: RegressionMetrics;
  /** Optional callback when residual plot toggle changes (regression only) */
  onResidualPlotToggle?: (show: boolean) => void;
  /** Whether the residual plot is currently visible (regression only) */
  showResidualPlot?: boolean;
}

/**
 * Metric configuration with thresholds for color coding.
 *
 * For classification metrics: higher is better (0-1 scale)
 * For regression metrics: depends on metric (RMSE/MAE lower is better, R² higher is better)
 */
const METRIC_CONFIG = {
  classification: {
    f1: {
      name: "F1 Score",
      description: "Harmonic mean of precision and recall",
      // Higher is better
      thresholds: { poor: 0.5, moderate: 0.7, good: 0.9 },
    },
    auc_roc: {
      name: "AUC-ROC",
      description: "Area under the ROC curve",
      // Higher is better
      thresholds: { poor: 0.6, moderate: 0.75, good: 0.9 },
    },
    precision: {
      name: "Precision",
      description: "Ratio of true positives to predicted positives",
      // Higher is better
      thresholds: { poor: 0.5, moderate: 0.7, good: 0.9 },
    },
    recall: {
      name: "Recall",
      description: "Ratio of true positives to actual positives",
      // Higher is better
      thresholds: { poor: 0.5, moderate: 0.7, good: 0.9 },
    },
  },
  regression: {
    rmse: {
      name: "RMSE",
      description: "Root Mean Square Error",
      // Lower is better (normalized thresholds relative to typical ranges)
      // For normalized data, lower values are better
      thresholds: { poor: 1.0, moderate: 0.5, good: 0.2 },
      lowerIsBetter: true,
    },
    mae: {
      name: "MAE",
      description: "Mean Absolute Error",
      // Lower is better
      thresholds: { poor: 0.8, moderate: 0.4, good: 0.15 },
      lowerIsBetter: true,
    },
    r2: {
      name: "R²",
      description: "Coefficient of determination",
      // Higher is better
      thresholds: { poor: 0.3, moderate: 0.6, good: 0.85 },
      lowerIsBetter: false,
    },
  },
} as const;

/**
 * Color scale for metric performance levels.
 */
const COLOR_SCALE = {
  good: {
    background: "#dcfce7",
    border: "#86efac",
    text: "#166534",
    value: "#15803d",
  },
  moderate: {
    background: "#fef9c3",
    border: "#fde047",
    text: "#854d0e",
    value: "#a16207",
  },
  poor: {
    background: "#fee2e2",
    border: "#fca5a5",
    text: "#991b1b",
    value: "#dc2626",
  },
} as const;

/**
 * Determine performance level based on metric value and thresholds.
 *
 * @param value - The metric value
 * @param thresholds - Threshold configuration
 * @param lowerIsBetter - Whether lower values indicate better performance
 * @returns Performance level: "good", "moderate", or "poor"
 */
function getPerformanceLevel(
  value: number,
  thresholds: { poor: number; moderate: number; good: number },
  lowerIsBetter = false
): "good" | "moderate" | "poor" {
  if (lowerIsBetter) {
    // For metrics where lower is better (RMSE, MAE)
    if (value <= thresholds.good) return "good";
    if (value <= thresholds.moderate) return "moderate";
    return "poor";
  }

  // For metrics where higher is better (F1, AUC-ROC, Precision, Recall, R²)
  if (value >= thresholds.good) return "good";
  if (value >= thresholds.moderate) return "moderate";
  return "poor";
}

/**
 * Format metric value to 4 decimal places.
 *
 * @param value - The numeric value to format
 * @returns Formatted string with 4 decimal places
 */
function formatMetricValue(value: number): string {
  return value.toFixed(4);
}

/**
 * Metric cards component.
 *
 * Renders a grid of metric cards showing performance metrics with color-coded
 * values indicating good (green), moderate (yellow), or poor (red) performance.
 *
 * @param props - Component props
 * @returns The metric cards component
 */
export function MetricCards({
  taskType,
  classificationMetrics,
  regressionMetrics,
  onResidualPlotToggle,
  showResidualPlot = false,
}: MetricCardsProps): JSX.Element {
  const [localShowResidual, setLocalShowResidual] = useState(showResidualPlot);

  /**
   * Handle residual plot toggle.
   */
  const handleToggleResidual = () => {
    const newValue = !localShowResidual;
    setLocalShowResidual(newValue);
    onResidualPlotToggle?.(newValue);
  };

  /**
   * Render classification metric cards.
   */
  const renderClassificationCards = (): JSX.Element => {
    if (!classificationMetrics) {
      return (
        <div style={styles.noData}>
          <p>No classification metrics available</p>
        </div>
      );
    }

    const metrics = [
      {
        key: "f1" as const,
        value: classificationMetrics.f1,
        config: METRIC_CONFIG.classification.f1,
      },
      {
        key: "auc_roc" as const,
        value: classificationMetrics.auc_roc,
        config: METRIC_CONFIG.classification.auc_roc,
      },
      {
        key: "precision" as const,
        value: classificationMetrics.precision,
        config: METRIC_CONFIG.classification.precision,
      },
      {
        key: "recall" as const,
        value: classificationMetrics.recall,
        config: METRIC_CONFIG.classification.recall,
      },
    ];

    return (
      <div style={styles.metricsGrid}>
        {metrics.map((metric) => {
          const level = getPerformanceLevel(
            metric.value,
            metric.config.thresholds,
            false
          );
          const colors = COLOR_SCALE[level];

          return (
            <div
              key={metric.key}
              style={{
                ...styles.metricCard,
                backgroundColor: colors.background,
                borderColor: colors.border,
              }}
              title={metric.config.description}
            >
              <span
                style={{
                  ...styles.metricLabel,
                  color: colors.text,
                }}
              >
                {metric.config.name}
              </span>
              <span
                style={{
                  ...styles.metricValue,
                  color: colors.value,
                }}
              >
                {formatMetricValue(metric.value)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * Render regression metric cards.
   */
  const renderRegressionCards = (): JSX.Element => {
    if (!regressionMetrics) {
      return (
        <div style={styles.noData}>
          <p>No regression metrics available</p>
        </div>
      );
    }

    const metrics = [
      {
        key: "rmse" as const,
        value: regressionMetrics.rmse,
        config: METRIC_CONFIG.regression.rmse,
      },
      {
        key: "mae" as const,
        value: regressionMetrics.mae,
        config: METRIC_CONFIG.regression.mae,
      },
      {
        key: "r2" as const,
        value: regressionMetrics.r2,
        config: METRIC_CONFIG.regression.r2,
      },
    ];

    return (
      <div style={styles.container}>
        <div style={styles.metricsGrid}>
          {metrics.map((metric) => {
            const level = getPerformanceLevel(
              metric.value,
              metric.config.thresholds,
              metric.config.lowerIsBetter
            );
            const colors = COLOR_SCALE[level];

            return (
              <div
                key={metric.key}
                style={{
                  ...styles.metricCard,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                }}
                title={metric.config.description}
              >
                <span
                  style={{
                    ...styles.metricLabel,
                    color: colors.text,
                  }}
                >
                  {metric.config.name}
                </span>
                <span
                  style={{
                    ...styles.metricValue,
                    color: colors.value,
                  }}
                >
                  {formatMetricValue(metric.value)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Residual Plot Toggle */}
        <div style={styles.toggleContainer}>
          <label style={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={localShowResidual}
              onChange={handleToggleResidual}
              style={styles.toggleInput}
              aria-label="Show residual plot"
            />
            <span style={styles.toggleText}>Show Residual Plot</span>
          </label>
          <span style={styles.toggleHint}>
            Visualize prediction errors vs actual values
          </span>
        </div>
      </div>
    );
  };

  return taskType === "classification"
    ? renderClassificationCards()
    : renderRegressionCards();
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "1rem",
  },
  metricCard: {
    border: "2px solid",
    borderRadius: "8px",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    transition: "all 0.2s ease",
  },
  metricLabel: {
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
    marginBottom: "0.5rem",
    fontWeight: 600,
  },
  metricValue: {
    fontSize: "1.5rem",
    fontWeight: 700,
    fontFamily: "monospace",
  },
  noData: {
    padding: "2rem",
    textAlign: "center",
    color: "#6b7280",
    fontSize: "0.875rem",
  },
  toggleContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    marginTop: "0.5rem",
  },
  toggleLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer",
  },
  toggleInput: {
    width: "16px",
    height: "16px",
    cursor: "pointer",
  },
  toggleText: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
  },
  toggleHint: {
    fontSize: "0.75rem",
    color: "#6b7280",
    marginLeft: "1.5rem",
  },
};
