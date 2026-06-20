/**
 * DropNullsConfig - Configuration panel for Drop Nulls block.
 *
 * Allows users to select which columns to check for null values.
 * Empty selection means all columns.
 *
 * @module components/block-configs/DropNullsConfig
 */

import { ColumnMultiSelect } from "./ColumnMultiSelect";
import { configStyles, type BlockConfigProps } from "./types";

/**
 * Drop Nulls block configuration panel.
 *
 * @param props - Component props
 * @returns The configuration panel
 */
export function DropNullsConfig({
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
      <h4 style={configStyles.title}>Drop Nulls Configuration</h4>
      <p style={configStyles.helpText}>
        Remove rows that contain null values in the selected columns.
      </p>

      <div style={configStyles.section}>
        <ColumnMultiSelect
          columns={availableColumns}
          selected={columns}
          onChange={handleColumnsChange}
          label="Columns to check"
          showSelectAll
          emptyMeansAll
        />
      </div>
    </div>
  );
}
