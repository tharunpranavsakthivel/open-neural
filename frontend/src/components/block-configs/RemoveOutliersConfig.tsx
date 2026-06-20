/**
 * RemoveOutliersConfig - Configuration panel for Remove Outliers block.
 *
 * Allows users to select which columns to filter outliers from and
 * configure the IQR multiplier threshold.
 *
 * @module components/block-configs/RemoveOutliersConfig
 */

import { ColumnMultiSelect } from "./ColumnMultiSelect";
import { configStyles, type BlockConfigProps } from "./types";

/**
 * Remove Outliers block configuration panel.
 *
 * @param props - Component props
 * @returns The configuration panel
 */
export function RemoveOutliersConfig({
  params,
  onChange,
  availableColumns,
}: BlockConfigProps): JSX.Element {
  const columns = (params.columns as string[]) ?? [];
  const iqrMultiplier = (params.iqr_multiplier as number) ?? 1.5;

  const handleColumnsChange = (selected: string[]): void => {
    onChange({ ...params, columns: selected });
  };

  const handleMultiplierChange = (value: string): void => {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      onChange({ ...params, iqr_multiplier: num });
    }
  };

  return (
    <div style={configStyles.container}>
      <h4 style={configStyles.title}>Remove Outliers Configuration</h4>
      <p style={configStyles.helpText}>
        Filter rows where values fall outside the interquartile range (IQR).
        Outliers are defined as values below Q1 - k×IQR or above Q3 + k×IQR.
      </p>

      <div style={configStyles.section}>
        <label style={configStyles.label}>IQR Multiplier</label>
        <div style={configStyles.inlineInput}>
          <input
            type="number"
            min="0.5"
            max="5"
            step="0.1"
            value={iqrMultiplier}
            onChange={(e) => handleMultiplierChange(e.target.value)}
            style={configStyles.numberInput}
            aria-describedby="iqr-help"
          />
        </div>
        <p id="iqr-help" style={configStyles.helpText}>
          Lower values remove more outliers (1.5 is standard, 3.0 is conservative)
        </p>
      </div>

      <div style={configStyles.section}>
        <ColumnMultiSelect
          columns={availableColumns.filter((c) => c.type === "numeric" || c.type === "integer" || c.type === "float")}
          selected={columns}
          onChange={handleColumnsChange}
          label="Numeric columns to filter"
          showSelectAll
        />
      </div>
    </div>
  );
}
