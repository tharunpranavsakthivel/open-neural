/**
 * ConfusionMatrix component - Renders confusion matrix visualization.
 *
 * For binary classification, displays a 2×2 grid with TN, FP, FN, TP cells
 * showing counts and percentage annotations.
 * For multiclass classification, displays an N×N heatmap with class labels
 * on axes and color intensity indicating cell magnitude.
 *
 * @module components/ConfusionMatrix
 */

/**
 * Binary confusion matrix data structure.
 */
export interface BinaryConfusionMatrix {
  /** True negatives */
  tn: number;
  /** False positives */
  fp: number;
  /** False negatives */
  fn: number;
  /** True positives */
  tp: number;
}

/**
 * Multiclass confusion matrix data structure.
 * 2D array where rows are actual classes and columns are predicted classes.
 */
export type MulticlassConfusionMatrix = number[][];

/**
 * Props for the ConfusionMatrix component.
 */
interface ConfusionMatrixProps {
  /** Type of classification task */
  taskType: "binary" | "multiclass";
  /** Binary confusion matrix (required for binary classification) */
  binaryMatrix?: BinaryConfusionMatrix;
  /** Multiclass confusion matrix (required for multiclass classification) */
  multiclassMatrix?: MulticlassConfusionMatrix;
  /** Class labels for multiclass (required for multiclass classification) */
  classLabels?: string[];
}

/**
 * Calculate color intensity for heatmap cells.
 *
 * @param value - Cell value (count)
 * @param maxValue - Maximum value in the matrix for normalization
 * @returns RGBA color string with intensity based on value
 */
function getHeatmapColor(value: number, maxValue: number): string {
  if (maxValue === 0) return "rgba(59, 130, 246, 0.05)";
  const intensity = Math.max(0.05, value / maxValue);
  // Blue scale: from light blue to dark blue
  return `rgba(59, 130, 246, ${intensity})`;
}

/**
 * Get text color based on background intensity for contrast.
 *
 * @param value - Cell value
 * @param maxValue - Maximum value in the matrix
 * @returns Text color for contrast
 */
function getTextColor(value: number, maxValue: number): string {
  if (maxValue === 0) return "#374151";
  const intensity = value / maxValue;
  // Use white text for darker backgrounds, dark text for lighter backgrounds
  return intensity > 0.5 ? "#ffffff" : "#111827";
}

/**
 * Confusion matrix component.
 *
 * Renders either a 2×2 binary confusion matrix or an N×N multiclass heatmap
 * depending on the task type.
 *
 * @param props - Component props
 * @returns The confusion matrix visualization
 */
export function ConfusionMatrix({
  taskType,
  binaryMatrix,
  multiclassMatrix,
  classLabels,
}: ConfusionMatrixProps): JSX.Element {
  /**
   * Render binary confusion matrix (2×2 grid).
   */
  const renderBinaryMatrix = (): JSX.Element => {
    if (!binaryMatrix) {
      return (
        <div style={styles.noData}>
          <p>No confusion matrix data available</p>
        </div>
      );
    }

    const { tn, fp, fn, tp } = binaryMatrix;
    const total = tn + fp + fn + tp;

    const cells = [
      {
        label: "True Negative",
        shortLabel: "TN",
        value: tn,
        description: "Correctly predicted negative",
        position: "top-left",
      },
      {
        label: "False Positive",
        shortLabel: "FP",
        value: fp,
        description: "Incorrectly predicted positive",
        position: "top-right",
      },
      {
        label: "False Negative",
        shortLabel: "FN",
        value: fn,
        description: "Incorrectly predicted negative",
        position: "bottom-left",
      },
      {
        label: "True Positive",
        shortLabel: "TP",
        value: tp,
        description: "Correctly predicted positive",
        position: "bottom-right",
      },
    ];

    // Calculate max value for color scaling (diagonal should be green, off-diagonal red/orange)
    const maxDiagonal = Math.max(tn, tp);
    const maxOffDiagonal = Math.max(fp, fn);

    return (
      <div style={styles.container}>
        {/* Axis labels */}
        <div style={styles.axisLabelsContainer}>
          <span style={styles.yAxisLabel}>Actual</span>
          <div style={styles.matrixWrapper}>
            {/* Column headers (Predicted) */}
            <div style={styles.columnHeaders}>
              <span style={styles.columnHeaderLabel}>Negative</span>
              <span style={styles.columnHeaderLabel}>Positive</span>
            </div>

            <div style={styles.binaryGrid}>
              {/* Row header and cells */}
              <div style={styles.rowWithHeader}>
                <span style={styles.rowHeaderLabel}>Negative</span>
                <div style={styles.rowCells}>
                  {cells.slice(0, 2).map((cell) => {
                    const isCorrect = cell.shortLabel === "TN";
                    const intensity =
                      total > 0
                        ? isCorrect
                          ? cell.value / maxDiagonal || 0
                          : cell.value / maxOffDiagonal || 0
                        : 0;

                    return (
                      <div
                        key={cell.shortLabel}
                        style={{
                          ...styles.binaryCell,
                          backgroundColor: isCorrect
                            ? `rgba(34, 197, 94, ${Math.max(0.1, intensity * 0.8)})` // Green for correct
                            : `rgba(239, 68, 68, ${Math.max(0.1, intensity * 0.8)})`, // Red for errors
                        }}
                        title={`${cell.label}: ${cell.description}`}
                      >
                        <span style={styles.cellShortLabel}>
                          {cell.shortLabel}
                        </span>
                        <span style={styles.cellValue}>
                          {cell.value.toLocaleString()}
                        </span>
                        <span style={styles.cellPercentage}>
                          {total > 0
                            ? `${((cell.value / total) * 100).toFixed(1)}%`
                            : "0%"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={styles.rowWithHeader}>
                <span style={styles.rowHeaderLabel}>Positive</span>
                <div style={styles.rowCells}>
                  {cells.slice(2, 4).map((cell) => {
                    const isCorrect = cell.shortLabel === "TP";
                    const intensity =
                      total > 0
                        ? isCorrect
                          ? cell.value / maxDiagonal || 0
                          : cell.value / maxOffDiagonal || 0
                        : 0;

                    return (
                      <div
                        key={cell.shortLabel}
                        style={{
                          ...styles.binaryCell,
                          backgroundColor: isCorrect
                            ? `rgba(34, 197, 94, ${Math.max(0.1, intensity * 0.8)})` // Green for correct
                            : `rgba(239, 68, 68, ${Math.max(0.1, intensity * 0.8)})`, // Red for errors
                        }}
                        title={`${cell.label}: ${cell.description}`}
                      >
                        <span style={styles.cellShortLabel}>
                          {cell.shortLabel}
                        </span>
                        <span style={styles.cellValue}>
                          {cell.value.toLocaleString()}
                        </span>
                        <span style={styles.cellPercentage}>
                          {total > 0
                            ? `${((cell.value / total) * 100).toFixed(1)}%`
                            : "0%"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* X-axis label */}
            <div style={styles.xAxisLabelContainer}>
              <span style={styles.xAxisLabel}>Predicted</span>
            </div>
          </div>
        </div>

        {/* Summary statistics */}
        <div style={styles.binarySummary}>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>Accuracy:</span>
            <span style={styles.summaryValue}>
              {total > 0
                ? `${(((tn + tp) / total) * 100).toFixed(1)}%`
                : "N/A"}
            </span>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>Total Samples:</span>
            <span style={styles.summaryValue}>{total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Render multiclass confusion matrix (N×N heatmap).
   */
  const renderMulticlassMatrix = (): JSX.Element => {
    if (!multiclassMatrix || !classLabels) {
      return (
        <div style={styles.noData}>
          <p>No multiclass confusion matrix data available</p>
        </div>
      );
    }

    const numClasses = classLabels.length;
    const maxValue = Math.max(
      ...multiclassMatrix.flat().filter((v) => typeof v === "number")
    );

    // Calculate totals for each row (actual class)
    const rowTotals = multiclassMatrix.map((row) =>
      row.reduce((sum, val) => sum + val, 0)
    );

    return (
      <div style={styles.container}>
        {/* Title and legend */}
        <div style={styles.multiclassHeader}>
          <span style={styles.multiclassTitle}>Predicted Class</span>
          <div style={styles.legend}>
            <span style={styles.legendLabel}>Lower</span>
            <div style={styles.legendGradient} />
            <span style={styles.legendLabel}>Higher</span>
          </div>
        </div>

        <div style={styles.multiclassWrapper}>
          {/* Y-axis label */}
          <div style={styles.yAxisLabelContainer}>
            <span style={styles.yAxisRotatedLabel}>Actual Class</span>
          </div>

          {/* Heatmap grid */}
          <div style={styles.heatmapContainer}>
            {/* Column headers (predicted classes) */}
            <div style={styles.heatmapHeaderRow}>
              <div style={styles.cornerCell} /> {/* Empty corner cell */}
              {classLabels.map((label, index) => (
                <div key={`col-${index}`} style={styles.columnHeader}>
                  <span
                    style={styles.columnHeaderText}
                    title={label}
                  >
                    {label.length > 8 ? `${label.slice(0, 8)}...` : label}
                  </span>
                </div>
              ))}
              <div style={styles.totalHeader}>Total</div>
            </div>

            {/* Matrix rows */}
            {multiclassMatrix.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} style={styles.heatmapRow}>
                {/* Row header (actual class) */}
                <div style={styles.rowHeader}>
                  <span style={styles.rowHeaderText} title={classLabels?.[rowIndex]}>
                    {(classLabels?.[rowIndex] ?? "").length > 8
                      ? `${(classLabels?.[rowIndex] ?? "").slice(0, 8)}...`
                      : classLabels?.[rowIndex] ?? ""}
                  </span>
                </div>

                {/* Cell values */}
                {row.map((value, colIndex) => {
                  const isDiagonal = rowIndex === colIndex;
                  const percentage =
                    (rowTotals[rowIndex] ?? 0) > 0
                      ? ((value / (rowTotals[rowIndex] ?? 1)) * 100).toFixed(1)
                      : "0";

                  return (
                    <div
                      key={`cell-${rowIndex}-${colIndex}`}
                      style={{
                        ...styles.heatmapCell,
                        backgroundColor: getHeatmapColor(value, maxValue),
                        border: isDiagonal
                          ? "2px solid #22c55e"
                          : "1px solid #e5e7eb",
                      }}
                      title={`Actual: ${classLabels?.[rowIndex] ?? ""}, Predicted: ${
                        classLabels?.[colIndex] ?? ""
                      }\nCount: ${value}\nPercentage: ${percentage}%`}
                    >
                      <span
                        style={{
                          ...styles.heatmapValue,
                          color: getTextColor(value, maxValue),
                        }}
                      >
                        {value.toLocaleString()}
                      </span>
                      <span
                        style={{
                          ...styles.heatmapPercentage,
                          color: getTextColor(value, maxValue),
                        }}
                      >
                        {percentage}%
                      </span>
                    </div>
                  );
                })}

                {/* Row total */}
                <div style={styles.rowTotal}>
                  <span style={styles.rowTotalValue}>
                    {(rowTotals[rowIndex] ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div style={styles.multiclassSummary}>
          <span style={styles.summaryLabel}>Classes:</span>
          <span style={styles.summaryValue}>{numClasses}</span>
          <span style={styles.summarySeparator}>|</span>
          <span style={styles.summaryLabel}>Total Samples:</span>
          <span style={styles.summaryValue}>
            {rowTotals.reduce((sum, total) => sum + total, 0).toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  return taskType === "binary"
    ? renderBinaryMatrix()
    : renderMulticlassMatrix();
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  noData: {
    padding: "2rem",
    textAlign: "center",
    color: "#6b7280",
    fontSize: "0.875rem",
  },

  // Binary matrix styles
  axisLabelsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  yAxisLabel: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
    marginBottom: "0.25rem",
  },
  matrixWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  columnHeaders: {
    display: "grid",
    gridTemplateColumns: "100px repeat(2, 1fr)",
    gap: "0.5rem",
    paddingLeft: "100px",
  },
  columnHeaderLabel: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#6b7280",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  binaryGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  rowWithHeader: {
    display: "grid",
    gridTemplateColumns: "100px 1fr",
    gap: "0.5rem",
    alignItems: "center",
  },
  rowHeaderLabel: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#6b7280",
    textAlign: "right",
    paddingRight: "0.5rem",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  rowCells: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.5rem",
  },
  binaryCell: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.25rem",
    borderRadius: "8px",
    gap: "0.25rem",
    minHeight: "100px",
    transition: "all 0.2s ease",
  },
  cellShortLabel: {
    fontSize: "0.875rem",
    fontWeight: 700,
    color: "#1f2937",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  cellValue: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#111827",
    fontFamily: "monospace",
  },
  cellPercentage: {
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "#4b5563",
  },
  xAxisLabelContainer: {
    textAlign: "center",
    marginTop: "0.25rem",
  },
  xAxisLabel: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  binarySummary: {
    display: "flex",
    justifyContent: "center",
    gap: "2rem",
    padding: "0.75rem",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
    marginTop: "0.5rem",
  },
  summaryItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  summaryLabel: {
    fontSize: "0.875rem",
    color: "#6b7280",
  },
  summaryValue: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#111827",
    fontFamily: "monospace",
  },

  // Multiclass matrix styles
  multiclassHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.5rem",
  },
  multiclassTitle: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#374151",
  },
  legend: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  legendLabel: {
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  legendGradient: {
    width: "80px",
    height: "12px",
    background: "linear-gradient(to right, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 1))",
    borderRadius: "2px",
  },
  multiclassWrapper: {
    display: "flex",
    gap: "0.5rem",
  },
  yAxisLabelContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "30px",
  },
  yAxisRotatedLabel: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
    writingMode: "vertical-rl",
    textOrientation: "mixed",
    transform: "rotate(180deg)",
  },
  heatmapContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    overflow: "auto",
    maxWidth: "100%",
  },
  heatmapHeaderRow: {
    display: "grid",
    gridTemplateColumns: "80px repeat(auto-fill, minmax(60px, 1fr)) 60px",
    gap: "2px",
    alignItems: "center",
  },
  cornerCell: {
    width: "80px",
    height: "40px",
  },
  columnHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.5rem",
    minWidth: "60px",
  },
  columnHeaderText: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#6b7280",
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
  },
  totalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.5rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#6b7280",
    minWidth: "60px",
  },
  heatmapRow: {
    display: "grid",
    gridTemplateColumns: "80px repeat(auto-fill, minmax(60px, 1fr)) 60px",
    gap: "2px",
    alignItems: "center",
  },
  rowHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: "0.5rem",
    paddingRight: "0.75rem",
  },
  rowHeaderText: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#6b7280",
    textAlign: "right",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
  },
  heatmapCell: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.5rem",
    borderRadius: "4px",
    minHeight: "50px",
    minWidth: "60px",
    transition: "all 0.2s ease",
  },
  heatmapValue: {
    fontSize: "0.875rem",
    fontWeight: 600,
    fontFamily: "monospace",
  },
  heatmapPercentage: {
    fontSize: "0.625rem",
    fontWeight: 500,
    opacity: 0.8,
  },
  rowTotal: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.5rem",
    backgroundColor: "#f3f4f6",
    borderRadius: "4px",
    minWidth: "60px",
  },
  rowTotalValue: {
    fontSize: "0.875rem",
    fontWeight: 700,
    color: "#374151",
    fontFamily: "monospace",
  },
  multiclassSummary: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.75rem",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
    marginTop: "0.5rem",
    flexWrap: "wrap",
  },
  summarySeparator: {
    color: "#d1d5db",
    margin: "0 0.25rem",
  },
};
