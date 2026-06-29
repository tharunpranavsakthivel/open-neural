/**
 * SnapshotHistory component - Displays project snapshot history.
 *
 * Renders a collapsible panel listing all dataset snapshots for a project.
 * Users can view snapshot details (version, row count, timestamp) and
 * select a different snapshot as the base for a new pipeline.
 *
 * @module components/SnapshotHistory
 */

import { useState, useEffect, useCallback } from "react";
import { fetchProjectSnapshots, type SnapshotListItem } from "../utils/api";

/**
 * Props for the SnapshotHistory component.
 */
interface SnapshotHistoryProps {
  /** Currently selected project ID */
  projectId: string;
  /** Currently active snapshot ID */
  currentSnapshotId?: string;
  /** Callback when a snapshot is selected */
  onSelectSnapshot: (snapshotId: string) => void;
}

/**
 * Format timestamp for display.
 *
 * @param timestamp - ISO 8601 timestamp string
 * @returns Formatted date/time string
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Snapshot history collapsible panel component.
 *
 * @param props - Component props
 * @returns The snapshot history component
 */
export function SnapshotHistory({
  projectId,
  currentSnapshotId,
  onSelectSnapshot,
}: SnapshotHistoryProps): JSX.Element {
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load snapshots for the project.
   */
  const loadSnapshots = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchProjectSnapshots(projectId);
      setSnapshots(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load snapshots");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Load snapshots when expanded
  useEffect(() => {
    if (isExpanded && snapshots.length === 0) {
      void loadSnapshots();
    }
  }, [isExpanded, snapshots.length, loadSnapshots]);

  /**
   * Toggle panel expansion.
   */
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  /**
   * Handle snapshot selection.
   */
  const handleSelectSnapshot = useCallback(
    (snapshotId: string) => {
      if (snapshotId !== currentSnapshotId) {
        onSelectSnapshot(snapshotId);
      }
    },
    [currentSnapshotId, onSelectSnapshot],
  );

  return (
    <div style={styles.container}>
      <button
        onClick={toggleExpanded}
        style={styles.header}
        type="button"
        aria-expanded={isExpanded}
        aria-controls="snapshot-history-panel"
      >
        <div style={styles.headerContent}>
          <span style={styles.headerIcon}>📚</span>
          <span style={styles.headerTitle}>Snapshot History</span>
          <span style={styles.snapshotCount}>
            {snapshots.length > 0 && `(${snapshots.length})`}
          </span>
        </div>
        <span
          style={{
            ...styles.chevron,
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </button>

      {isExpanded && (
        <div
          id="snapshot-history-panel"
          style={styles.panel}
          role="region"
          aria-label="Snapshot history list"
        >
          {isLoading && (
            <div style={styles.loadingState}>
              <div style={styles.spinner} />
              <span style={styles.loadingText}>Loading snapshots...</span>
            </div>
          )}

          {error && (
            <div style={styles.errorState}>
              <span style={styles.errorIcon}>❌</span>
              <span style={styles.errorText}>{error}</span>
            </div>
          )}

          {!isLoading && !error && snapshots.length === 0 && (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>📂</span>
              <p style={styles.emptyText}>No snapshots yet</p>
              <p style={styles.emptySubtext}>
                Upload a dataset to create your first snapshot
              </p>
            </div>
          )}

          {!isLoading && !error && snapshots.length > 0 && (
            <div style={styles.snapshotList}>
              {snapshots.map((snapshot, index) => {
                const isCurrent = snapshot.id === currentSnapshotId;
                const isFirst = index === 0;

                return (
                  <div
                    key={snapshot.id}
                    style={{
                      ...styles.snapshotItem,
                      ...(isCurrent ? styles.snapshotItemCurrent : {}),
                    }}
                  >
                    <div style={styles.snapshotInfo}>
                      <div style={styles.snapshotHeader}>
                        <span style={styles.versionLabel}>
                          {snapshot.version_label}
                        </span>
                        {isCurrent && (
                          <span style={styles.currentBadge}>Current</span>
                        )}
                        {isFirst && !isCurrent && (
                          <span style={styles.latestBadge}>Latest</span>
                        )}
                      </div>
                      <div style={styles.snapshotMeta}>
                        <span style={styles.metaItem}>
                          📊 {snapshot.row_count.toLocaleString()} rows
                        </span>
                        <span style={styles.metaDivider}>•</span>
                        <span style={styles.metaItem}>
                          📅 {formatTimestamp(snapshot.created_at)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSelectSnapshot(snapshot.id)}
                      disabled={isCurrent}
                      style={{
                        ...styles.selectButton,
                        ...(isCurrent ? styles.selectButtonDisabled : {}),
                      }}
                      type="button"
                      title={
                        isCurrent
                          ? "This is the current snapshot"
                          : "Select this snapshot"
                      }
                    >
                      {isCurrent ? "Selected" : "Select"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  header: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.875rem 1rem",
    backgroundColor: "#f9fafb",
    border: "none",
    borderBottom: "1px solid #e5e7eb",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
    textAlign: "left" as const,
  },
  headerContent: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  headerIcon: {
    fontSize: "1.25rem",
  },
  headerTitle: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#374151",
  },
  snapshotCount: {
    fontSize: "0.75rem",
    color: "#6b7280",
    fontWeight: 500,
  },
  chevron: {
    fontSize: "0.75rem",
    color: "#6b7280",
    transition: "transform 0.2s ease",
  },
  panel: {
    padding: "0.75rem",
    maxHeight: "400px",
    overflowY: "auto" as const,
  },
  loadingState: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.75rem",
    padding: "2rem",
    color: "#6b7280",
  },
  spinner: {
    width: "20px",
    height: "20px",
    border: "2px solid #e5e7eb",
    borderTopColor: "#2563eb",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    fontSize: "0.875rem",
  },
  errorState: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "1.5rem",
    color: "#dc2626",
    fontSize: "0.875rem",
  },
  errorIcon: {
    fontSize: "1rem",
  },
  errorText: {},
  emptyState: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    textAlign: "center" as const,
  },
  emptyIcon: {
    fontSize: "2rem",
    marginBottom: "0.5rem",
  },
  emptyText: {
    margin: 0,
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
  },
  emptySubtext: {
    margin: "0.25rem 0 0 0",
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  snapshotList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },
  snapshotItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "0.75rem",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    backgroundColor: "#fafafa",
    transition: "background-color 0.15s ease, border-color 0.15s ease",
  },
  snapshotItemCurrent: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  },
  snapshotInfo: {
    flex: 1,
    minWidth: 0, // Allow text truncation
  },
  snapshotHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "0.25rem",
  },
  versionLabel: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#111827",
  },
  currentBadge: {
    fontSize: "0.625rem",
    fontWeight: 600,
    color: "#1e40af",
    backgroundColor: "#dbeafe",
    padding: "0.125rem 0.375rem",
    borderRadius: "4px",
    textTransform: "uppercase" as const,
  },
  latestBadge: {
    fontSize: "0.625rem",
    fontWeight: 600,
    color: "#15803d",
    backgroundColor: "#dcfce7",
    padding: "0.125rem 0.375rem",
    borderRadius: "4px",
    textTransform: "uppercase" as const,
  },
  snapshotMeta: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  metaItem: {
    whiteSpace: "nowrap" as const,
  },
  metaDivider: {
    color: "#d1d5db",
  },
  selectButton: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "#ffffff",
    backgroundColor: "#2563eb",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
    whiteSpace: "nowrap" as const,
  },
  selectButtonDisabled: {
    backgroundColor: "#9ca3af",
    cursor: "not-allowed",
  },
};
