/**
 * ColumnMultiSelect component - Reusable column multi-select for block configs.
 *
 * Provides a scrollable list of checkboxes for selecting multiple columns,
 * with optional "Select All" functionality and type badges.
 *
 * @module components/block-configs/ColumnMultiSelect
 */

import { useCallback } from "react";
import { configStyles, type ColumnOption } from "./types";

interface ColumnMultiSelectProps {
  /** Available columns to select from */
  columns: ColumnOption[];
  /** Currently selected column values */
  selected: string[];
  /** Callback when selection changes */
  onChange: (selected: string[]) => void;
  /** Optional label for the component */
  label?: string;
  /** Whether to show "Select All" option */
  showSelectAll?: boolean;
  /** Whether an empty selection means "all columns" */
  emptyMeansAll?: boolean;
}

/**
 * Multi-select component for choosing dataset columns.
 *
 * Features:
 * - Scrollable checkbox list
 * - Select All / Deselect All
 * - Column type badges
 * - Keyboard accessible
 *
 * @param props - Component props
 * @returns The column multi-select component
 */
export function ColumnMultiSelect({
  columns,
  selected,
  onChange,
  label,
  showSelectAll = true,
  emptyMeansAll = false,
}: ColumnMultiSelectProps): JSX.Element {
  const allSelected = selected.length === columns.length && columns.length > 0;
  const someSelected = selected.length > 0 && selected.length < columns.length;
  const isEmpty = selected.length === 0;

  /**
   * Toggle selection of a single column.
   */
  const handleToggleColumn = useCallback(
    (columnValue: string) => {
      const newSelected = selected.includes(columnValue)
        ? selected.filter((c) => c !== columnValue)
        : [...selected, columnValue];
      onChange(newSelected);
    },
    [selected, onChange]
  );

  /**
   * Toggle all columns selection.
   */
  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(columns.map((c) => c.value));
    }
  }, [allSelected, columns, onChange]);

  return (
    <div>
      {label && (
        <label style={configStyles.label}>{label}</label>
      )}
      <div style={configStyles.multiSelect} role="group" aria-label={label ?? "Column selection"}>
        {showSelectAll && (
          <button
            type="button"
            onClick={handleToggleAll}
            style={{
              ...configStyles.selectAll,
              color: someSelected ? "#6b7280" : "#2563eb",
            }}
            aria-checked={allSelected ? "true" : someSelected ? "mixed" : "false"}
            role="checkbox"
          >
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) {
                  el.indeterminate = someSelected;
                }
              }}
              onChange={() => {}} // Handled by parent button
              style={configStyles.checkboxInput}
              aria-hidden="true"
            />
            <span>
              {isEmpty ? "Select All" : allSelected ? "Deselect All" : `${selected.length} selected`}
            </span>
          </button>
        )}

        {columns.map((column) => (
          <label key={column.value} style={configStyles.columnItem}>
            <input
              type="checkbox"
              checked={selected.includes(column.value)}
              onChange={() => handleToggleColumn(column.value)}
              style={configStyles.checkboxInput}
            />
            <span>{column.label}</span>
            {column.type && (
              <span style={configStyles.columnType}>{column.type}</span>
            )}
          </label>
        ))}

        {columns.length === 0 && (
          <p style={{ ...configStyles.helpText, textAlign: "center", padding: "1rem 0" }}>
            No columns available
          </p>
        )}
      </div>

      {emptyMeansAll && isEmpty && (
        <p style={configStyles.helpText}>Leaving empty applies to all columns</p>
      )}
    </div>
  );
}
