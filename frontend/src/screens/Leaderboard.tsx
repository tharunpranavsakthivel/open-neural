/**
 * Leaderboard screen - Step 6: Experiment comparison leaderboard.
 *
 * Displays all experiments in a sortable, interactive table.
 * On mount, fetches leaderboard data from the backend API.
 * Supports sorting by any metric column (F1, AUC-ROC, Precision, Recall, Training Time).
 *
 * Per SRS FR-COMP-01: Displays all experiments in a leaderboard table.
 * Per SRS FR-COMP-02: Allows sorting by any metric column.
 * Per SRS FR-COMP-03: Highlights the globally best experiment with a "best" badge.
 * Per SRS FR-COMP-04: Allows navigation to the evaluation dashboard of any experiment.
 *
 * @module screens/Leaderboard
 */
import { useEffect, useState } from "react";
import {
  fetchLeaderboard,
  type LeaderboardEntry,
  type LeaderboardSortBy,
  type LeaderboardOrder,
} from "../utils/api";
import { useAppStore, type WizardStep } from "../stores/appStore";

/**
 * Props for the Leaderboard component.
 */
interface LeaderboardProps {
  /** Currently selected project ID */
  projectId: string;
}

/**
 * Column definition for the leaderboard table.
 */
interface ColumnDef {
  /** Column key for data access */
  key: LeaderboardSortBy | "experiment_id_human" | "best_model_type";
  /** Display label for the column header */
  label: string;
  /** Whether this column is sortable */
  sortable: boolean;
  /** Width style for the column */
  width: string;
}

/**
 * Column definitions for the leaderboard table.
 */
const COLUMNS: ColumnDef[] = [
  { key: "experiment_id_human", label: "Experiment ID", sortable: false, width: "180px" },
  { key: "best_model_type", label: "Best Model", sortable: false, width: "140px" },
  { key: "f1", label: "F1", sortable: true, width: "100px" },
  { key: "auc_roc", label: "AUC-ROC", sortable: true, width: "100px" },
  { key: "precision", label: "Precision", sortable: true, width: "100px" },
  { key: "recall", label: "Recall", sortable: true, width: "100px" },
  { key: "training_time", label: "Training Time", sortable: true, width: "120px" },
];

/**
 * Format a metric value for display.
 *
 * @param value - The metric value (may be undefined)
 * @returns Formatted string with 4 decimal places, or "—" if undefined
 */
function formatMetric(value: number | undefined): string {
  if (value === undefined || value === null) {
    return "—";
  }
  return value.toFixed(4);
}

/**
 * Format training time in seconds to a human-readable string.
 *
 * @param seconds - Training time in seconds
 * @returns Formatted string (e.g., "3m 42s" or "1h 2m")
 */
function formatTrainingTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/**
 * Sort direction indicator arrow component.
 *
 * @param props - Component props
 * @param props.direction - The sort direction
 * @returns Arrow indicator or null if not active
 */
function SortArrow({ direction }: { direction: LeaderboardOrder }): JSX.Element {
  return (
    <span style={styles.sortArrow}>{direction === "desc" ? "▼" : "▲"}</span>
  );
}

/**
 * Leaderboard wizard step component.
 *
 * Fetches leaderboard data on mount with default sort (F1, desc).
 * Supports sorting by clicking column headers.
 * Displays "BEST" badge on the globally best experiment.
 * Navigates to evaluation dashboard when clicking a row.
 *
 * @param props - Component props
 * @param props.projectId - The currently selected project ID
 * @returns The leaderboard screen
 */
export function Leaderboard({ projectId }: LeaderboardProps): JSX.Element {
  const { setCurrentStep, setCurrentExperimentId } = useAppStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<LeaderboardSortBy>("f1");
  const [order, setOrder] = useState<LeaderboardOrder>("desc");

  /**
   * Fetch leaderboard data from the API.
   *
   * Per SRS FR-COMP-01: On mount, fetch with sort_by=f1&order=desc.
   */
  useEffect(() => {
    const loadLeaderboard = async (): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchLeaderboard(projectId, sortBy, order);
        setEntries(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load leaderboard";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadLeaderboard();
  }, [projectId, sortBy, order]);

  /**
   * Handle column header click to toggle sort.
   *
   * Per SRS FR-COMP-02: Clicking a column header toggles sort order.
   *
   * @param columnKey - The column key to sort by
   */
  const handleSort = (columnKey: LeaderboardSortBy): void => {
    if (sortBy === columnKey) {
      // Toggle order: desc -> asc -> desc
      setOrder(order === "desc" ? "asc" : "desc");
    } else {
      // New column, default to desc
      setSortBy(columnKey);
      setOrder("desc");
    }
  };

  /**
   * Handle row click to navigate to evaluation dashboard.
   *
   * Per SRS FR-COMP-04: Navigate to evaluation dashboard for the clicked experiment.
   *
   * @param experimentId - The experiment ID to navigate to
   */
  const handleRowClick = (experimentId: string): void => {
    setCurrentExperimentId(experimentId);
    setCurrentStep("evaluation" as WizardStep);
  };

  /**
   * Render the table header with sortable columns.
   *
   * @returns The table header JSX
   */
  const renderHeader = (): JSX.Element => (
    <thead>
      <tr>
        {COLUMNS.map((column) => (
          <th
            key={column.key}
            style={{
              ...styles.th,
              width: column.width,
              cursor: column.sortable ? "pointer" : "default",
            }}
            onClick={
              column.sortable
                ? () => handleSort(column.key as LeaderboardSortBy)
                : undefined
            }
            role={column.sortable ? "button" : undefined}
            tabIndex={column.sortable ? 0 : undefined}
            onKeyDown={
              column.sortable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSort(column.key as LeaderboardSortBy);
                    }
                  }
                : undefined
            }
          >
            <div style={styles.thContent}>
              <span>{column.label}</span>
              {column.sortable && sortBy === column.key && (
                <SortArrow direction={order} />
              )}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );

  /**
   * Render the table body with experiment rows.
   *
   * Per SRS FR-COMP-03: Highlight the globally best experiment with "BEST" badge.
   *
   * @returns The table body JSX
   */
  const renderBody = (): JSX.Element => (
    <tbody>
      {entries.map((entry) => (
        <tr
          key={entry.experiment_id}
          style={entry.is_best ? styles.bestRow : styles.row}
          onClick={() => handleRowClick(entry.experiment_id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleRowClick(entry.experiment_id);
            }
          }}
        >
          <td style={styles.td}>
            <div style={styles.cellContent}>
              {entry.experiment_id_human}
              {entry.is_best && (
                <span style={styles.bestBadge}>BEST</span>
              )}
            </div>
          </td>
          <td style={styles.td}>{entry.best_model_type}</td>
          <td style={styles.td}>{formatMetric(entry.metrics.f1)}</td>
          <td style={styles.td}>{formatMetric(entry.metrics.auc_roc)}</td>
          <td style={styles.td}>{formatMetric(entry.metrics.precision)}</td>
          <td style={styles.td}>{formatMetric(entry.metrics.recall)}</td>
          <td style={styles.td}>{formatTrainingTime(entry.training_time_seconds)}</td>
        </tr>
      ))}
    </tbody>
  );

  /**
   * Render loading state.
   *
   * @returns The loading state JSX
   */
  const renderLoading = (): JSX.Element => (
    <div style={styles.loadingContainer}>
      <div style={styles.spinner} />
      <p style={styles.loadingText}>Loading leaderboard...</p>
    </div>
  );

  /**
   * Render error state.
   *
   * @returns The error state JSX
   */
  const renderError = (): JSX.Element => (
    <div style={styles.errorContainer}>
      <p style={styles.errorText}>Error: {error}</p>
      <button
        type="button"
        style={styles.retryButton}
        onClick={() => {
          setIsLoading(true);
          setError(null);
          fetchLeaderboard(projectId, sortBy, order)
            .then((data) => {
              setEntries(data);
              setIsLoading(false);
            })
            .catch((err) => {
              const message = err instanceof Error ? err.message : "Failed to load";
              setError(message);
              setIsLoading(false);
            });
        }}
      >
        Retry
      </button>
    </div>
  );

  /**
   * Render empty state.
   *
   * Per Task 188: Empty state when no experiments exist.
   *
   * @returns The empty state JSX
   */
  const renderEmpty = (): JSX.Element => (
    <div style={styles.emptyContainer}>
      <p style={styles.emptyTitle}>No experiments yet</p>
      <p style={styles.emptyDescription}>
        Run your first experiment to see results here.
      </p>
    </div>
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Leaderboard</h1>
        <p style={styles.description}>
          Compare experiments and view performance rankings.
        </p>
      </header>

      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h2 style={styles.tableTitle}>Experiments</h2>
          <div style={styles.sortInfo}>
            <span style={styles.sortLabel}>
              Sorted by: <strong>{COLUMNS.find((c) => c.key === sortBy)?.label || "F1"}</strong>
              {" "}
              ({order === "desc" ? "descending" : "ascending"})
            </span>
          </div>
        </div>

        {isLoading ? (
          renderLoading()
        ) : error ? (
          renderError()
        ) : entries.length === 0 ? (
          renderEmpty()
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              {renderHeader()}
              {renderBody()}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "1200px",
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
  tableCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.5rem",
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  tableTitle: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  sortInfo: {
    fontSize: "0.875rem",
    color: "#6b7280",
  },
  sortLabel: {
    fontSize: "0.875rem",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.875rem",
  },
  th: {
    padding: "0.75rem 1rem",
    textAlign: "left",
    fontWeight: 600,
    color: "#374151",
    borderBottom: "2px solid #e5e7eb",
    whiteSpace: "nowrap",
    userSelect: "none",
  },
  thContent: {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
  },
  sortArrow: {
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  row: {
    borderBottom: "1px solid #e5e7eb",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  bestRow: {
    borderBottom: "1px solid #e5e7eb",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
    backgroundColor: "#f0fdf4",
  },
  td: {
    padding: "0.75rem 1rem",
    color: "#374151",
    borderBottom: "1px solid #e5e7eb",
  },
  cellContent: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  bestBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.125rem 0.5rem",
    fontSize: "0.625rem",
    fontWeight: 700,
    color: "#ffffff",
    backgroundColor: "#22c55e",
    borderRadius: "9999px",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  loadingContainer: {
    padding: "4rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #e5e7eb",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    margin: 0,
    color: "#6b7280",
    fontSize: "0.875rem",
  },
  errorContainer: {
    padding: "4rem",
    textAlign: "center",
  },
  errorText: {
    margin: "0 0 1rem 0",
    color: "#dc2626",
    fontSize: "0.875rem",
  },
  retryButton: {
    padding: "0.5rem 1rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#ffffff",
    backgroundColor: "#3b82f6",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  emptyContainer: {
    padding: "4rem",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
    textAlign: "center",
  },
  emptyTitle: {
    margin: "0 0 0.5rem 0",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#374151",
  },
  emptyDescription: {
    margin: 0,
    color: "#6b7280",
    fontSize: "0.875rem",
  },
};
