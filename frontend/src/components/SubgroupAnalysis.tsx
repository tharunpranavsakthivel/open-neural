/**
 * SubgroupAnalysis component - Renders a table of subgroup slices with performance metrics.
 *
 * Displays a table with columns: Slice Name, N, F1, Recall, Fairness Warning.
 * Renders a yellow warning flag icon on rows where fairness_warning is true.
 * Each row is expandable to show additional metrics (Precision, sample count, diagnostic note).
 *
 * @module components/SubgroupAnalysis
 */
import { useState } from "react";

/**
 * Subgroup data item with fairness warning flag.
 */
export interface SubgroupData {
  /** Name of the slice/subgroup */
  slice_name: string;
  /** Sample count in this subgroup */
  n: number;
  /** Performance metrics */
  metrics: {
    f1?: number;
    recall?: number;
    precision?: number;
  };
  /** Whether this subgroup has a fairness warning */
  fairness_warning: boolean;
  /** Diagnostic note explaining the warning (optional) */
  diagnostic_note?: string;
}

/**
 * Props for the SubgroupAnalysis component.
 */
interface SubgroupAnalysisProps {
  /** Array of subgroup data */
  subgroups: SubgroupData[];
  /** Overall F1 score for comparison (to calculate warnings) */
  overallF1?: number;
  /** Threshold for fairness warning (F1 difference) */
  warningThreshold?: number;
}

/**
 * Chevron icon for expandable rows.
 */
function ChevronIcon({ expanded }: { expanded: boolean }): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{
        transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.2s ease",
      }}
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="#6b7280"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Warning flag icon for fairness warnings.
 */
function WarningIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M8.00001 5.33337V8.00004M8.00001 10.6667H8.00668M14.6667 8.00004C14.6667 11.682 11.6819 14.6667 8.00001 14.6667C4.31811 14.6667 1.33334 11.682 1.33334 8.00004C1.33334 4.31814 4.31811 1.33337 8.00001 1.33337C11.6819 1.33337 14.6667 4.31814 14.6667 8.00004Z"
        stroke="#f59e0b"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 5.33337V8.66671"
        stroke="#f59e0b"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11.3333" r="0.666667" fill="#f59e0b" />
    </svg>
  );
}

/**
 * Format metric value for display.
 */
function formatMetric(value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  return value.toFixed(3);
}

/**
 * Subgroup analysis table component.
 *
 * Renders a table of subgroup slices with expandable rows showing
 * performance metrics and fairness warnings.
 *
 * @param props - Component props
 * @returns The subgroup analysis table
 */
export function SubgroupAnalysis({
  subgroups,
  overallF1,
  warningThreshold = 0.15,
}: SubgroupAnalysisProps): JSX.Element {
  /** Set of expanded row indices */
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  /**
   * Toggle row expansion.
   */
  const toggleRow = (index: number): void => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  /**
   * Check if a subgroup has a fairness warning.
   */
  const hasFairnessWarning = (subgroup: SubgroupData): boolean => {
    if (subgroup.fairness_warning) return true;
    if (overallF1 === undefined) return false;
    if (subgroup.metrics.f1 === undefined) return false;
    // Warning if F1 is significantly below overall
    return overallF1 - subgroup.metrics.f1 > warningThreshold;
  };

  /**
   * Get diagnostic note for a subgroup.
   */
  const getDiagnosticNote = (subgroup: SubgroupData): string => {
    if (subgroup.diagnostic_note) return subgroup.diagnostic_note;
    if (overallF1 !== undefined && subgroup.metrics.f1 !== undefined) {
      const diff = overallF1 - subgroup.metrics.f1;
      if (diff > warningThreshold) {
        return `F1 score is ${diff.toFixed(3)} points below overall model performance (${overallF1.toFixed(3)}). Consider investigating this subgroup for potential bias or data quality issues.`;
      }
    }
    return "Performance within acceptable range.";
  };

  if (subgroups.length === 0) {
    return (
      <div style={styles.emptyContainer}>
        <p style={styles.emptyText}>No subgroup analysis available.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Subgroup Analysis</h3>
        <p style={styles.description}>
          Performance breakdown by feature segments. Subgroups with F1 more than{" "}
          {(warningThreshold * 100).toFixed(0)}% below overall are flagged.
        </p>
      </div>

      {/* Table */}
      <div style={styles.tableContainer}>
        {/* Table Header */}
        <div style={styles.tableHeader}>
          <span style={styles.headerCellExpand} />
          <span style={styles.headerCellName}>Slice Name</span>
          <span style={styles.headerCellCount}>N</span>
          <span style={styles.headerCellMetric}>F1</span>
          <span style={styles.headerCellMetric}>Recall</span>
          <span style={styles.headerCellWarning}>Warning</span>
        </div>

        {/* Table Body */}
        <div style={styles.tableBody}>
          {subgroups.map((subgroup, index) => {
            const isExpanded = expandedRows.has(index);
            const hasWarning = hasFairnessWarning(subgroup);

            return (
              <div key={index} style={styles.rowContainer}>
                {/* Main Row */}
                <div
                  style={{
                    ...styles.dataRow,
                    ...(hasWarning ? styles.dataRowWarning : {}),
                  }}
                  onClick={() => toggleRow(index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleRow(index);
                    }
                  }}
                  aria-expanded={isExpanded}
                  aria-label={`Subgroup ${subgroup.slice_name}, click to ${isExpanded ? "collapse" : "expand"}`}
                >
                  <span style={styles.cellExpand}>
                    <ChevronIcon expanded={isExpanded} />
                  </span>
                  <span style={styles.cellName}>
                    {subgroup.slice_name}
                    {hasWarning && (
                      <span
                        style={styles.warningBadge}
                        title="Fairness warning: performance significantly below overall"
                      >
                        <WarningIcon />
                      </span>
                    )}
                  </span>
                  <span style={styles.cellCount}>
                    {subgroup.n.toLocaleString()}
                  </span>
                  <span style={styles.cellMetric}>
                    {formatMetric(subgroup.metrics.f1)}
                  </span>
                  <span style={styles.cellMetric}>
                    {formatMetric(subgroup.metrics.recall)}
                  </span>
                  <span style={styles.cellWarning}>
                    {hasWarning ? (
                      <span style={styles.warningFlag}>
                        <WarningIcon />
                        <span style={styles.warningText}>Warning</span>
                      </span>
                    ) : (
                      <span style={styles.noWarning}>—</span>
                    )}
                  </span>
                </div>

                {/* Expanded Row */}
                {isExpanded && (
                  <div
                    style={{
                      ...styles.expandedRow,
                      ...(hasWarning ? styles.expandedRowWarning : {}),
                    }}
                  >
                    <div style={styles.expandedContent}>
                      {/* Additional Metrics */}
                      <div style={styles.metricsSection}>
                        <h4 style={styles.sectionTitle}>Additional Metrics</h4>
                        <div style={styles.metricsGrid}>
                          <div style={styles.metricItem}>
                            <span style={styles.metricLabel}>Precision:</span>
                            <span style={styles.metricValue}>
                              {formatMetric(subgroup.metrics.precision)}
                            </span>
                          </div>
                          <div style={styles.metricItem}>
                            <span style={styles.metricLabel}>Sample Count:</span>
                            <span style={styles.metricValue}>
                              {subgroup.n.toLocaleString()}
                            </span>
                          </div>
                          {overallF1 !== undefined &&
                            subgroup.metrics.f1 !== undefined && (
                              <div style={styles.metricItem}>
                                <span style={styles.metricLabel}>
                                  F1 vs Overall:
                                </span>
                                <span
                                  style={{
                                    ...styles.metricValue,
                                    ...((overallF1 - subgroup.metrics.f1 >
                                      warningThreshold)
                                      ? styles.metricValueNegative
                                      : styles.metricValuePositive),
                                  }}
                                >
                                  {(subgroup.metrics.f1 - overallF1).toFixed(3)}
                                </span>
                              </div>
                            )}
                        </div>
                      </div>

                      {/* Diagnostic Note */}
                      <div
                        style={{
                          ...styles.noteSection,
                          ...(hasWarning ? styles.noteSectionWarning : {}),
                        }}
                      >
                        <h4 style={styles.sectionTitle}>
                          {hasWarning ? "⚠ Diagnostic Note" : "ℹ Diagnostic Note"}
                        </h4>
                        <p style={styles.noteText}>{getDiagnosticNote(subgroup)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div style={styles.summary}>
        <span style={styles.summaryLabel}>Total Subgroups:</span>
        <span style={styles.summaryValue}>{subgroups.length}</span>
        <span style={styles.summarySeparator}>|</span>
        <span style={styles.summaryLabel}>Warnings:</span>
        <span style={styles.summaryValueWarning}>
          {subgroups.filter((s) => hasFairnessWarning(s)).length}
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  header: {
    marginBottom: "0.5rem",
  },
  title: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.125rem",
    fontWeight: 600,
    color: "#111827",
  },
  description: {
    margin: 0,
    fontSize: "0.875rem",
    color: "#6b7280",
    lineHeight: 1.5,
  },
  emptyContainer: {
    padding: "2rem",
    textAlign: "center",
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    border: "1px dashed #d1d5db",
  },
  emptyText: {
    margin: 0,
    fontSize: "0.875rem",
    color: "#6b7280",
  },
  tableContainer: {
    display: "flex",
    flexDirection: "column",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    overflow: "hidden",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "40px 2fr 1fr 1fr 1fr 100px",
    gap: "0.5rem",
    padding: "0.75rem 1rem",
    backgroundColor: "#f3f4f6",
    borderBottom: "1px solid #e5e7eb",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
    alignItems: "center",
  },
  headerCellExpand: {
    width: "40px",
  },
  headerCellName: {
    paddingLeft: "0.5rem",
  },
  headerCellCount: {
    textAlign: "right",
  },
  headerCellMetric: {
    textAlign: "right",
  },
  headerCellWarning: {
    textAlign: "center",
  },
  tableBody: {
    display: "flex",
    flexDirection: "column",
  },
  rowContainer: {
    display: "flex",
    flexDirection: "column",
    borderBottom: "1px solid #f3f4f6",
  },
  dataRow: {
    display: "grid",
    gridTemplateColumns: "40px 2fr 1fr 1fr 1fr 100px",
    gap: "0.5rem",
    padding: "0.75rem 1rem",
    backgroundColor: "#ffffff",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
    alignItems: "center",
    outline: "none",
  },
  dataRowWarning: {
    backgroundColor: "#fefce8",
  },
  cellExpand: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
  },
  cellName: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    paddingLeft: "0.5rem",
    fontSize: "0.875rem",
    color: "#374151",
  },
  cellCount: {
    textAlign: "right",
    fontSize: "0.875rem",
    color: "#374151",
    fontFamily: "monospace",
  },
  cellMetric: {
    textAlign: "right",
    fontSize: "0.875rem",
    color: "#374151",
    fontFamily: "monospace",
  },
  cellWarning: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  warningBadge: {
    display: "flex",
    alignItems: "center",
  },
  warningFlag: {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
    padding: "0.25rem 0.5rem",
    backgroundColor: "#fef3c7",
    border: "1px solid #f59e0b",
    borderRadius: "4px",
  },
  warningText: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#92400e",
  },
  noWarning: {
    fontSize: "0.875rem",
    color: "#9ca3af",
  },
  expandedRow: {
    backgroundColor: "#f9fafb",
    borderTop: "1px solid #e5e7eb",
    padding: "1rem",
  },
  expandedRowWarning: {
    backgroundColor: "#fefce8",
  },
  expandedContent: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    paddingLeft: "40px",
  },
  metricsSection: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  sectionTitle: {
    margin: "0 0 0.5rem 0",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "1rem",
  },
  metricItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.5rem 0.75rem",
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "4px",
  },
  metricLabel: {
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  metricValue: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#111827",
    fontFamily: "monospace",
  },
  metricValuePositive: {
    color: "#16a34a",
  },
  metricValueNegative: {
    color: "#dc2626",
  },
  noteSection: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    padding: "0.75rem",
    backgroundColor: "#f3f4f6",
    borderRadius: "6px",
    borderLeft: "3px solid #9ca3af",
  },
  noteSectionWarning: {
    backgroundColor: "#fef3c7",
    borderLeftColor: "#f59e0b",
  },
  noteText: {
    margin: 0,
    fontSize: "0.875rem",
    color: "#374151",
    lineHeight: 1.5,
  },
  summary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "0.75rem",
    backgroundColor: "#f3f4f6",
    borderRadius: "6px",
    fontSize: "0.875rem",
    flexWrap: "wrap",
  },
  summaryLabel: {
    color: "#6b7280",
  },
  summaryValue: {
    fontWeight: 600,
    color: "#111827",
  },
  summaryValueWarning: {
    fontWeight: 600,
    color: "#f59e0b",
  },
  summarySeparator: {
    color: "#d1d5db",
    margin: "0 0.25rem",
  },
};
