/**
 * Block configuration shared types and utilities.
 *
 * Provides common types, interfaces, and utility components used across
 * all block configuration panels.
 *
 * @module components/block-configs/types
 */

/**
 * Column option for multi-select components.
 */
export interface ColumnOption {
  /** Column name */
  value: string;
  /** Display label */
  label: string;
  /** Column data type */
  type?: string;
}

/**
 * Base props for all block configuration panels.
 */
export interface BlockConfigProps {
  /** Current parameter values */
  params: Record<string, unknown>;
  /** Callback when parameters change */
  onChange: (params: Record<string, unknown>) => void;
  /** Available columns from the dataset schema */
  availableColumns: ColumnOption[];
}

/**
 * Common styles for block configuration panels.
 */
export const configStyles: Record<string, React.CSSProperties> = {
  container: {
    padding: "1rem",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
  },
  title: {
    margin: "0 0 1rem 0",
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#374151",
  },
  section: {
    marginBottom: "1rem",
  },
  sectionTitle: {
    margin: "0 0 0.5rem 0",
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  label: {
    display: "block",
    marginBottom: "0.25rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 0",
    cursor: "pointer",
    fontSize: "0.875rem",
    color: "#374151",
  },
  checkboxInput: {
    width: "16px",
    height: "16px",
    cursor: "pointer",
  },
  radioGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  radio: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer",
    fontSize: "0.875rem",
    color: "#374151",
  },
  radioInput: {
    width: "16px",
    height: "16px",
    cursor: "pointer",
  },
  select: {
    width: "100%",
    padding: "0.5rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    backgroundColor: "#ffffff",
    cursor: "pointer",
  },
  multiSelect: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    maxHeight: "200px",
    overflowY: "auto",
    padding: "0.5rem",
    backgroundColor: "#ffffff",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
  },
  selectAll: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 0",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: "0.5rem",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#2563eb",
  },
  columnItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.375rem 0",
    cursor: "pointer",
    fontSize: "0.875rem",
    color: "#374151",
  },
  columnType: {
    fontSize: "0.75rem",
    color: "#6b7280",
    marginLeft: "auto",
    padding: "0.125rem 0.375rem",
    backgroundColor: "#f3f4f6",
    borderRadius: "4px",
  },
  input: {
    width: "100%",
    padding: "0.5rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
  },
  numberInput: {
    width: "100px",
    padding: "0.5rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
  },
  sliderContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  slider: {
    width: "100%",
    cursor: "pointer",
  },
  sliderLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  helpText: {
    margin: "0.25rem 0 0 0",
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  inlineInput: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  inlineInputLabel: {
    fontSize: "0.875rem",
    color: "#374151",
    minWidth: "60px",
  },
};
