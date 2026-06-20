/**
 * DatasetSummary component - Displays dataset metadata cards.
 *
 * Renders summary cards showing key dataset statistics including
 * row count, column count, file size, snapshot version, and creation
 * timestamp. Provides a quick overview of the imported dataset.
 *
 * @module components/DatasetSummary
 */

import type { DatasetSnapshotResponse } from "../utils/api";

/**
 * Props for the DatasetSummary component.
 */
interface DatasetSummaryProps {
  /** Complete snapshot response from the backend */
  snapshot: DatasetSnapshotResponse;
}

/**
 * Format file size in human-readable format.
 *
 * @param bytes - File size in bytes
 * @returns Human-readable string (e.g., "1.5 MB")
 */
function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format timestamp in locale-aware format.
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
 * Dataset summary cards component.
 *
 * @param props - Component props
 * @returns The dataset summary component
 */
export function DatasetSummary({ snapshot }: DatasetSummaryProps): JSX.Element {
  const cards = [
    {
      id: "rowCount",
      icon: "📊",
      label: "Row Count",
      value: snapshot.row_count.toLocaleString(),
      color: "#2563eb", // blue-600
      bgColor: "#eff6ff", // blue-50
    },
    {
      id: "colCount",
      icon: "📋",
      label: "Column Count",
      value: snapshot.col_count.toString(),
      color: "#7c3aed", // violet-600
      bgColor: "#f5f3ff", // violet-50
    },
    {
      id: "fileSize",
      icon: "💾",
      label: "File Size",
      value: formatFileSize(snapshot.file_size_bytes),
      color: "#059669", // emerald-600
      bgColor: "#ecfdf5", // emerald-50
    },
    {
      id: "version",
      icon: "🏷️",
      label: "Snapshot Version",
      value: snapshot.version_label,
      color: "#d97706", // amber-600
      bgColor: "#fffbeb", // amber-50
    },
    {
      id: "createdAt",
      icon: "📅",
      label: "Created At",
      value: formatTimestamp(snapshot.created_at),
      color: "#dc2626", // red-600
      bgColor: "#fef2f2", // red-50
    },
  ];

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Dataset Summary</h3>
      <div style={styles.grid}>
        {cards.map((card) => (
          <div
            key={card.id}
            style={{
              ...styles.card,
              borderLeftColor: card.color,
            }}
          >
            <div
              style={{
                ...styles.iconContainer,
                backgroundColor: card.bgColor,
                color: card.color,
              }}
            >
              <span style={styles.icon}>{card.icon}</span>
            </div>
            <div style={styles.content}>
              <p style={styles.label}>{card.label}</p>
              <p style={styles.value}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: "1.5rem",
    padding: "1.5rem",
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
  },
  title: {
    margin: "0 0 1rem 0",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "1rem",
  },
  card: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "1rem",
    backgroundColor: "#fafafa",
    borderRadius: "6px",
    borderLeftWidth: "4px",
    borderLeftStyle: "solid",
  },
  iconContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    borderRadius: "8px",
    flexShrink: 0,
  },
  icon: {
    fontSize: "1.25rem",
    lineHeight: 1,
  },
  content: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.25rem",
    minWidth: 0, // Allow text truncation
  },
  label: {
    margin: 0,
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  value: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 700,
    color: "#111827",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
};
