/**
 * ExportStatus component - Displays per-artifact export status indicators.
 *
 * Renders a list of artifact items with their export status (pending/success/error)
 * and file size after export. Shows visual indicators: green checkmark on success,
 * red X on failure, and spinner for pending state.
 *
 * Per SRS FR-EXP-07: display per-artifact confirmation indicator (Saved / Export button)
 * and final completion notice when all artifacts are written successfully.
 *
 * @module components/ExportStatus
 */

/**
 * Export status type for each artifact.
 */
export type ExportStatus = "pending" | "success" | "error";

/**
 * Artifact export item with status and metadata.
 */
export interface ArtifactExportItem {
  /** Unique artifact type identifier */
  artifactType: "model" | "pipeline" | "report" | "predictions";
  /** Display name for the artifact */
  name: string;
  /** Current export status */
  status: ExportStatus;
  /** File size in bytes (available after successful export) */
  fileSizeBytes?: number;
  /** Error message (only when status is "error") */
  errorMessage?: string;
  /** Exported file path (only when status is "success") */
  filePath?: string;
}

/**
 * Props for the ExportStatus component.
 */
interface ExportStatusProps {
  /** Array of artifact export items to display */
  artifacts: ArtifactExportItem[];
  /** Optional callback when user clicks to retry a failed export */
  onRetry?: (artifactType: string) => void;
}

/**
 * Format file size from bytes to human-readable string.
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB", "256 KB")
 */
function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Get artifact icon based on type.
 *
 * @param artifactType - Type of artifact
 * @returns Icon emoji string
 */
function getArtifactIcon(artifactType: string): string {
  const icons: Record<string, string> = {
    model: "🧠",
    pipeline: "⚙️",
    report: "📊",
    predictions: "📄",
  };
  return icons[artifactType] || "📦";
}

/**
 * Status indicator component showing icon and text.
 *
 * @param props - Component props
 * @returns Status indicator element
 */
function StatusIndicator({ status }: { status: ExportStatus }): JSX.Element {
  const statusConfig: Record<
    ExportStatus,
    { icon: string; color: string; backgroundColor: string; label: string }
  > = {
    pending: {
      icon: "⏳",
      color: "#d97706",
      backgroundColor: "#fef3c7",
      label: "Pending",
    },
    success: {
      icon: "✓",
      color: "#16a34a",
      backgroundColor: "#dcfce7",
      label: "Success",
    },
    error: {
      icon: "✕",
      color: "#dc2626",
      backgroundColor: "#fee2e2",
      label: "Error",
    },
  };

  const config = statusConfig[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.25rem 0.5rem",
        backgroundColor: config.backgroundColor,
        color: config.color,
        borderRadius: "4px",
        fontSize: "0.75rem",
        fontWeight: 600,
      }}
      title={config.label}
    >
      <span style={{ fontSize: "0.875rem" }}>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

/**
 * Export status component.
 *
 * Renders a list of artifact export items with:
 * - Visual status indicators (pending spinner, green checkmark, red X)
 * - File size display for successful exports
 * - Error messages for failed exports
 * - Retry button for failed exports
 *
 * @param props - Component props
 * @returns The export status component
 */
export function ExportStatus({
  artifacts,
  onRetry,
}: ExportStatusProps): JSX.Element {
  /**
   * Check if all exports are complete.
   */
  const allComplete = artifacts.every(
    (artifact) => artifact.status === "success" || artifact.status === "error",
  );

  /**
   * Check if all exports succeeded.
   */
  const allSucceeded = artifacts.every(
    (artifact) => artifact.status === "success",
  );

  /**
   * Count successful exports.
   */
  const successCount = artifacts.filter((a) => a.status === "success").length;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Export Status</h3>
        {allComplete && (
          <span
            style={{
              ...styles.summaryBadge,
              ...(allSucceeded
                ? styles.summaryBadgeSuccess
                : styles.summaryBadgePartial),
            }}
          >
            {successCount}/{artifacts.length} Complete
          </span>
        )}
      </div>

      {/* Artifact List */}
      <div style={styles.artifactList}>
        {artifacts.map((artifact) => (
          <div
            key={artifact.artifactType}
            style={{
              ...styles.artifactItem,
              ...(artifact.status === "error" ? styles.artifactItemError : {}),
            }}
          >
            {/* Icon and Name */}
            <div style={styles.artifactInfo}>
              <span style={styles.artifactIcon}>
                {getArtifactIcon(artifact.artifactType)}
              </span>
              <span style={styles.artifactName}>{artifact.name}</span>
            </div>

            {/* Status and File Info */}
            <div style={styles.artifactStatus}>
              {artifact.status === "success" &&
                artifact.fileSizeBytes !== undefined && (
                  <span style={styles.fileSize}>
                    {formatFileSize(artifact.fileSizeBytes)}
                  </span>
                )}
              <StatusIndicator status={artifact.status} />
              {artifact.status === "error" && onRetry && (
                <button
                  onClick={() => onRetry(artifact.artifactType)}
                  style={styles.retryButton}
                  title="Retry export"
                >
                  Retry
                </button>
              )}
            </div>

            {/* Error Message */}
            {artifact.status === "error" && artifact.errorMessage && (
              <div style={styles.errorMessage}>{artifact.errorMessage}</div>
            )}

            {/* File Path (on hover or expand) */}
            {artifact.status === "success" && artifact.filePath && (
              <div style={styles.filePath} title={artifact.filePath}>
                {artifact.filePath}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {artifacts.length === 0 && (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No artifacts selected for export</p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1rem",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.75rem",
    paddingBottom: "0.75rem",
    borderBottom: "1px solid #e5e7eb",
  },
  title: {
    margin: 0,
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#374151",
  },
  summaryBadge: {
    padding: "0.25rem 0.5rem",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: 600,
  },
  summaryBadgeSuccess: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  summaryBadgePartial: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  artifactList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  artifactItem: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    padding: "0.75rem",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
  },
  artifactItemError: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  artifactInfo: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  artifactIcon: {
    fontSize: "1.25rem",
  },
  artifactName: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#111827",
  },
  artifactStatus: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginLeft: "1.75rem",
    flexWrap: "wrap",
  },
  fileSize: {
    fontSize: "0.75rem",
    color: "#6b7280",
    fontFamily: "monospace",
  },
  retryButton: {
    padding: "0.125rem 0.375rem",
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    border: "1px solid #fecaca",
    borderRadius: "4px",
    fontSize: "0.625rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  errorMessage: {
    marginLeft: "1.75rem",
    fontSize: "0.75rem",
    color: "#dc2626",
    marginTop: "0.25rem",
  },
  filePath: {
    marginLeft: "1.75rem",
    fontSize: "0.75rem",
    color: "#6b7280",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  emptyState: {
    padding: "1.5rem",
    textAlign: "center",
  },
  emptyText: {
    margin: 0,
    fontSize: "0.875rem",
    color: "#6b7280",
  },
};
