/**
 * FeatureSelectionConfig - Configuration panel for Feature Selection block.
 *
 * Allows users to select which columns to drop from the dataset.
 *
 * @module components/block-configs/FeatureSelectionConfig
 */

import { ColumnMultiSelect } from "./ColumnMultiSelect";
import { configStyles, type BlockConfigProps } from "./types";

/**
 * Feature Selection block configuration panel.
 *
 * @param props - Component props
 * @returns The configuration panel
 */
export function FeatureSelectionConfig({
  params,
  onChange,
  availableColumns,
}: BlockConfigProps): JSX.Element {
  const columns = (params.columns as string[]) ?? [];

  const handleColumnsChange = (selected: string[]): void => {
    onChange({ ...params, columns: selected });
  };

  return (
    <div style={configStyles.container}>
      <h4 style={configStyles.title}>Feature Selection Configuration</h4>
      <p style={configStyles.helpText}>
        Remove selected columns from the dataset. This is useful for dropping
        identifiers, timestamps, or other columns that should not be used for
        training.
      </p>

      <div style={configStyles.section}>
        <ColumnMultiSelect
          columns={availableColumns}
          selected={columns}
          onChange={handleColumnsChange}
          label="Columns to drop"
          showSelectAll
        />
      </div>

      {columns.length > 0 && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              color: "#dc2626",
              fontWeight: 500,
            }}
          >
            ⚠️ {columns.length} column{columns.length === 1 ? "" : "s"} will be
            removed
          </p>
        </div>
      )}
    </div>
  );
}
