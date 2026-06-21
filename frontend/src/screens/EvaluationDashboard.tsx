/**
 * EvaluationDashboard screen - Step 5: Evaluation dashboard and metrics.
 *
 * Displays model evaluation metrics, confusion matrix, subgroup analysis,
 * and decision threshold slider. On mount, fetches evaluation data from
 * GET /api/v1/experiments/{id}/evaluation and renders all evaluation components.
 *
 * @module screens/EvaluationDashboard
 */
import { useEffect, useState } from "react";
import {
  fetchExperimentEvaluation,
  type EvaluationResponse,
  type UpdateThresholdResponse,
} from "../utils/api";
import { MetricCards } from "../components/MetricCards";
import { ConfusionMatrix } from "../components/ConfusionMatrix";
import { ThresholdSlider } from "../components/ThresholdSlider";

/**
 * Props for the EvaluationDashboard component.
 */
interface EvaluationDashboardProps {
  /** Currently selected experiment ID */
  experimentId: string;
}

/**
 * Evaluation dashboard wizard step component.
 *
 * Fetches evaluation data on mount and displays:
 * - Metric summary cards (F1, AUC-ROC, Precision, Recall)
 * - Confusion matrix visualization
 * - Decision threshold slider (binary classification only)
 * - Subgroup analysis table
 *
 * @param props - Component props
 * @returns The evaluation dashboard screen
 */
export function EvaluationDashboard({
  experimentId,
}: EvaluationDashboardProps): JSX.Element {
  /** Evaluation data state */
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  /** Loading state */
  const [isLoading, setIsLoading] = useState(true);
  /** Error state */
  const [error, setError] = useState<string | null>(null);
  /** Current threshold for slider */
  const [currentThreshold, setCurrentThreshold] = useState(0.5);
  /** Threshold-adjusted metrics */
  const [thresholdMetrics, setThresholdMetrics] =
    useState<UpdateThresholdResponse | null>(null);

  /**
   * Fetch evaluation data on component mount.
   *
   * Calls GET /api/v1/experiments/{id}/evaluation to load metrics,
   * confusion matrix, and subgroup analyses from the backend.
   */
  useEffect(() => {
    /**
     * Fetch evaluation data from the backend.
     */
    async function loadEvaluation(): Promise<void> {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchExperimentEvaluation(experimentId);
        setEvaluation(data);
        setCurrentThreshold(data.threshold);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to load evaluation data";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }

    loadEvaluation();
  }, [experimentId]);



  /**
   * Format metric value for display.
   */
  const formatMetric = (value: number | undefined): string => {
    if (value === undefined || value === null) return "—";
    return value.toFixed(3);
  };

  /**
   * Get the effective metrics (either threshold-adjusted or original).
   */
  const getEffectiveMetrics = () => {
    if (thresholdMetrics) {
      return {
        f1: thresholdMetrics.f1,
        auc_roc: evaluation?.metrics.auc_roc ?? 0,
        precision: thresholdMetrics.precision,
        recall: thresholdMetrics.recall,
      };
    }
    return evaluation?.metrics ?? null;
  };

  const effectiveMetrics = getEffectiveMetrics();



  /**
   * Check if a subgroup has a warning flag (F1 more than 0.15 below overall).
   */
  const hasSubgroupWarning = (subgroupF1: number): boolean => {
    if (!evaluation?.metrics.f1) return false;
    return evaluation.metrics.f1 - subgroupF1 > 0.15;
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Evaluation</h1>
          <p style={styles.description}>Loading evaluation results...</p>
        </header>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading evaluation data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !evaluation) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Evaluation</h1>
          <p style={styles.description}>
            Review model performance metrics and analysis.
          </p>
        </header>
        <div style={styles.errorContainer}>
          <span style={styles.errorIcon}>⚠</span>
          <h2 style={styles.errorTitle}>Failed to Load Evaluation</h2>
          <p style={styles.errorMessage}>
            {error || "No evaluation data available. Please complete training first."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Evaluation</h1>
        <p style={styles.description}>
          Review model performance metrics and analysis.
        </p>
      </header>

      {/* Best Model Info */}
      <div style={styles.bestModelCard}>
        <div style={styles.bestModelHeader}>
          <span style={styles.bestModelBadge}>Best Model</span>
          <span style={styles.bestModelType}>
            {evaluation.best_model_type}
          </span>
        </div>
        <p style={styles.bestModelId}>Run ID: {evaluation.best_run_id}</p>
      </div>

      {/* Metric Cards Component */}
      <MetricCards
        taskType="classification"
        classificationMetrics={{
          f1: effectiveMetrics?.f1 ?? 0,
          auc_roc: effectiveMetrics?.auc_roc ?? 0,
          precision: effectiveMetrics?.precision ?? 0,
          recall: effectiveMetrics?.recall ?? 0,
        }}
      />

      <div style={styles.contentGrid}>
        {/* Confusion Matrix */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Confusion Matrix</h2>
          <ConfusionMatrix
            taskType="binary"
            binaryMatrix={{
              tn: evaluation.confusion_matrix.tn,
              fp: evaluation.confusion_matrix.fp,
              fn: evaluation.confusion_matrix.fn,
              tp: evaluation.confusion_matrix.tp,
            }}
          />
        </div>

        {/* Threshold Slider */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Decision Threshold</h2>
          <ThresholdSlider
            experimentId={experimentId}
            initialThreshold={evaluation.threshold}
            onThresholdChange={(newThreshold) => setCurrentThreshold(newThreshold)}
            onMetricsUpdate={(metrics) => setThresholdMetrics(metrics)}
          />
          {thresholdMetrics && (
            <div style={styles.thresholdMetricsPreview}>
              <p style={styles.thresholdMetricsTitle}>
                Metrics at threshold {currentThreshold.toFixed(2)}:
              </p>
              <div style={styles.thresholdMetricsGrid}>
                <div>
                  <span style={styles.thresholdMetricLabel}>Precision:</span>{" "}
                  <span style={styles.thresholdMetricValue}>
                    {formatMetric(thresholdMetrics.precision)}
                  </span>
                </div>
                <div>
                  <span style={styles.thresholdMetricLabel}>Recall:</span>{" "}
                  <span style={styles.thresholdMetricValue}>
                    {formatMetric(thresholdMetrics.recall)}
                  </span>
                </div>
                <div>
                  <span style={styles.thresholdMetricLabel}>F1:</span>{" "}
                  <span style={styles.thresholdMetricValue}>
                    {formatMetric(thresholdMetrics.f1)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subgroup Analysis */}
      {evaluation.subgroup_analyses.length > 0 && (
        <div style={styles.subgroupCard}>
          <h2 style={styles.cardTitle}>Subgroup Analysis</h2>
          <p style={styles.subgroupDescription}>
            Performance breakdown by feature segments. Subgroups with F1 more
            than 0.15 below overall are flagged.
          </p>
          <div style={styles.subgroupTable}>
            <div style={styles.subgroupHeader}>
              <span style={styles.subgroupColName}>Slice</span>
              <span style={styles.subgroupColCount}>Samples</span>
              <span style={styles.subgroupColMetric}>F1 Score</span>
              <span style={styles.subgroupColMetric}>Recall</span>
            </div>
            {evaluation.subgroup_analyses.map((subgroup, index) => {
              const hasWarning = hasSubgroupWarning(subgroup.metrics.f1 ?? 0);
              return (
                <div
                  key={index}
                  style={{
                    ...styles.subgroupRow,
                    ...(hasWarning ? styles.subgroupRowWarning : {}),
                  }}
                >
                  <span style={styles.subgroupColName}>
                    {subgroup.slice_name}
                    {hasWarning && (
                      <span style={styles.warningBadge} title="Low F1 warning">
                        ⚠
                      </span>
                    )}
                  </span>
                  <span style={styles.subgroupColCount}>
                    {subgroup.n.toLocaleString()}
                  </span>
                  <span style={styles.subgroupColMetric}>
                    {formatMetric(subgroup.metrics.f1)}
                  </span>
                  <span style={styles.subgroupColMetric}>
                    {formatMetric(subgroup.metrics.recall)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "2rem",
  },
  header: {
    marginBottom: "1.5rem",
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
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "4rem",
    gap: "1rem",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #e5e7eb",
    borderTop: "3px solid #2563eb",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    color: "#6b7280",
    fontSize: "0.875rem",
  },
  errorContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "3rem",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    gap: "0.75rem",
  },
  errorIcon: {
    fontSize: "2rem",
    color: "#dc2626",
  },
  errorTitle: {
    margin: 0,
    fontSize: "1.125rem",
    fontWeight: 600,
    color: "#991b1b",
  },
  errorMessage: {
    margin: 0,
    color: "#7f1d1d",
    fontSize: "0.875rem",
    textAlign: "center",
  },
  bestModelCard: {
    backgroundColor: "#dcfce7",
    border: "1px solid #86efac",
    borderRadius: "8px",
    padding: "1rem 1.5rem",
    marginBottom: "1.5rem",
  },
  bestModelHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "0.5rem",
  },
  bestModelBadge: {
    padding: "0.25rem 0.5rem",
    backgroundColor: "#22c55e",
    color: "#ffffff",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: 600,
  },
  bestModelType: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "#166534",
    textTransform: "capitalize",
  },
  bestModelId: {
    margin: 0,
    fontSize: "0.75rem",
    color: "#15803d",
    fontFamily: "monospace",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "1rem",
    marginBottom: "2rem",
  },
  metricCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  metricLabel: {
    fontSize: "0.75rem",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
    marginBottom: "0.5rem",
  },
  metricValue: {
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#111827",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
    gap: "1.5rem",
    marginBottom: "2rem",
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.5rem",
  },
  cardTitle: {
    margin: "0 0 1rem 0",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },

  thresholdMetricsPreview: {
    marginTop: "0.5rem",
    padding: "1rem",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
  },
  thresholdMetricsTitle: {
    margin: "0 0 0.75rem 0",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
  },
  thresholdMetricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "1rem",
  },
  thresholdMetricLabel: {
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  thresholdMetricValue: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#111827",
    fontFamily: "monospace",
  },
  subgroupCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.5rem",
  },
  subgroupDescription: {
    margin: "0 0 1rem 0",
    fontSize: "0.875rem",
    color: "#6b7280",
  },
  subgroupTable: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  subgroupHeader: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr",
    gap: "1rem",
    padding: "0.75rem",
    backgroundColor: "#f3f4f6",
    borderRadius: "6px",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  subgroupRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr",
    gap: "1rem",
    padding: "0.75rem",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
    fontSize: "0.875rem",
    color: "#374151",
    alignItems: "center",
  },
  subgroupRowWarning: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
  },
  subgroupColName: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  subgroupColCount: {
    textAlign: "right",
  },
  subgroupColMetric: {
    textAlign: "right",
    fontFamily: "monospace",
  },
  warningBadge: {
    color: "#dc2626",
    fontSize: "0.875rem",
  },
};
