/**
 * LogTransformConfig - Configuration panel for Log Transform block.
 *
 * Allows users to select which numeric columns to apply log transformation to.
 *
 * @module components/block-configs/LogTransformConfig
 */

import { ColumnMultiSelect } from "./ColumnMultiSelect";
import { configStyles, type BlockConfigProps } from "./types";

/**
 * Log Transform block configuration panel.
 *
 * @param props - Component props
 * @returns The configuration panel
 */
export function LogTransformConfig({
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
      <h4 style={configStyles.title}>Log Transform Configuration</h4>
      <p style={configStyles.helpText}>
        Apply natural logarithm transformation to reduce skewness in numeric
        data. Uses log1p (log(1 + x)) to handle zero and near-zero values
        safely.
      </p>

      <div style={configStyles.section}>
        <ColumnMultiSelect
          columns={availableColumns.filter(
            (c) =>
              c.type === "numeric" ||
              c.type === "integer" ||
              c.type === "float",
          )}
          selected={columns}
          onChange={handleColumnsChange}
          label="Numeric columns to transform"
          showSelectAll
        />
      </div>

      <p style={configStyles.helpText}>
        <strong>Note:</strong> This transformation requires positive values.
        Non-positive values will be skipped.
      </p>
    </div>
  );
}
