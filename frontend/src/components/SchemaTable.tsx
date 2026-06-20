/**
 * SchemaTable component - Displays inferred dataset schema.
 *
 * Renders a table showing column metadata including name, inferred type,
 * null percentage, and unique value count. Each type is displayed with
 * a distinct colored badge for quick visual identification.
 *
 * @module components/SchemaTable
 */

import type { DatasetSnapshotResponse } from "../utils/api";

/**
 * Props for the SchemaTable component.
 */
interface SchemaTableProps {
  /** Schema array from dataset snapshot response */
  schema: DatasetSnapshotResponse["schema"];
}

/**
 * Type badge style definition.
 */
interface TypeBadgeStyle {
  /** Background color */
  background: string;
  /** Text color */
  color: string;
}

/**
 * Type badge configuration with colors for each data type.
 * Uses strict type assertion to ensure TypeScript knows all keys are defined.
 */
const TYPE_BADGE_STYLES: {
  string: TypeBadgeStyle;
  integer: TypeBadgeStyle;
  float: TypeBadgeStyle;
  boolean: TypeBadgeStyle;
  categorical: TypeBadgeStyle;
  unknown: TypeBadgeStyle;
} = {
  string: {
    background: "#dbeafe", // blue-100
    color: "#1e40af",      // blue-800
  },
  integer: {
    background: "#dcfce7", // green-100
    color: "#166534",      // green-800
  },
  float: {
    background: "#e0e7ff", // indigo-100
    color: "#3730a3",      // indigo-800
  },
  boolean: {
    background: "#fef3c7", // amber-100
    color: "#92400e",      // amber-800
  },
  categorical: {
    background: "#f3e8ff", // purple-100
    color: "#6b21a8",      // purple-800
  },
  unknown: {
    background: "#f3f4f6", // gray-100
    color: "#374151",      // gray-700
  },
};

/**
 * Get the style configuration for a type badge.
 *
 * @param type - The inferred data type
 * @returns Object with background and color styles
 */
function getTypeBadgeStyle(type: string): TypeBadgeStyle {
  const normalizedType = type.toLowerCase();
  switch (normalizedType) {
    case "string":
      return TYPE_BADGE_STYLES.string;
    case "integer":
      return TYPE_BADGE_STYLES.integer;
    case "float":
      return TYPE_BADGE_STYLES.float;
    case "boolean":
      return TYPE_BADGE_STYLES.boolean;
    case "categorical":
      return TYPE_BADGE_STYLES.categorical;
    default:
      return TYPE_BADGE_STYLES.unknown;
  }
}

/**
 * Format null percentage for display.
 *
 * @param nullPct - Null percentage value (0-100)
 * @returns Formatted string with % symbol
 */
function formatNullPercentage(nullPct: number): string {
  if (nullPct === 0) {
    return "0%";
  }
  if (nullPct < 0.01) {
    return "<0.01%";
  }
  return `${nullPct.toFixed(2)}%`;
}

/**
 * Format unique count for display.
 *
 * @param count - Unique value count
 * @returns Formatted string with commas
 */
function formatUniqueCount(count: number): string {
  return count.toLocaleString();
}

/**
 * Schema table component displaying column metadata.
 *
 * @param props - Component props
 * @returns The schema table component
 */
export function SchemaTable({ schema }: SchemaTableProps): JSX.Element {
  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Inferred Schema</h3>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.headerRow}>
              <th style={{ ...styles.th, ...styles.columnNameTh }}>
                Column Name
              </th>
              <th style={{ ...styles.th, ...styles.typeTh }}>
                Inferred Type
              </th>
              <th style={{ ...styles.th, ...styles.nullTh }}>
                Null %
              </th>
              <th style={{ ...styles.th, ...styles.uniqueTh }}>
                Unique Count
              </th>
            </tr>
          </thead>
          <tbody>
            {schema.map((column, index) => {
              const badgeStyle = getTypeBadgeStyle(column.inferred_type);
              const rowStyle =
                index % 2 === 0 ? styles.evenRow : styles.oddRow;

              return (
                <tr key={column.name} style={rowStyle}>
                  <td style={styles.td}>
                    <code style={styles.columnName}>{column.name}</code>
                  </td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.typeBadge,
                        backgroundColor: badgeStyle.background,
                        color: badgeStyle.color,
                      }}
                    >
                      {column.inferred_type}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.nullValue,
                        color: column.null_pct > 0 ? "#dc2626" : "#16a34a",
                      }}
                    >
                      {formatNullPercentage(column.null_pct)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {formatUniqueCount(column.unique_count)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={styles.legend}>
        <span style={styles.legendTitle}>Type Legend:</span>
        {Object.entries(TYPE_BADGE_STYLES)
          .filter(([type]) => type !== "unknown")
          .map(([type, colors]) => (
            <span key={type} style={styles.legendItem}>
              <span
                style={{
                  ...styles.legendBadge,
                  backgroundColor: colors.background,
                  color: colors.color,
                }}
              >
                {type}
              </span>
            </span>
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
  tableWrapper: {
    overflowX: "auto" as const,
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.875rem",
  },
  headerRow: {
    backgroundColor: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
  },
  th: {
    padding: "0.75rem 1rem",
    textAlign: "left" as const,
    fontWeight: 600,
    color: "#374151",
    fontSize: "0.75rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    whiteSpace: "nowrap" as const,
  },
  columnNameTh: {
    minWidth: "200px",
  },
  typeTh: {
    minWidth: "120px",
  },
  nullTh: {
    minWidth: "80px",
    textAlign: "center" as const,
  },
  uniqueTh: {
    minWidth: "100px",
    textAlign: "right" as const,
  },
  td: {
    padding: "0.75rem 1rem",
    color: "#374151",
    borderBottom: "1px solid #f3f4f6",
  },
  evenRow: {
    backgroundColor: "#ffffff",
  },
  oddRow: {
    backgroundColor: "#fafafa",
  },
  columnName: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "0.8125rem",
    color: "#1f2937",
  },
  typeBadge: {
    display: "inline-block",
    padding: "0.25rem 0.75rem",
    borderRadius: "9999px",
    fontSize: "0.75rem",
    fontWeight: 500,
    textTransform: "capitalize" as const,
  },
  nullValue: {
    display: "inline-block",
    textAlign: "center" as const,
    width: "100%",
    fontWeight: 500,
  },
  legend: {
    marginTop: "1rem",
    paddingTop: "1rem",
    borderTop: "1px solid #e5e7eb",
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    gap: "0.75rem",
  },
  legendTitle: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  legendItem: {
    display: "inline-flex",
  },
  legendBadge: {
    padding: "0.125rem 0.5rem",
    borderRadius: "4px",
    fontSize: "0.625rem",
    fontWeight: 500,
    textTransform: "capitalize" as const,
  },
};
