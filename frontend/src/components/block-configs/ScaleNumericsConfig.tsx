/**
 * ScaleNumericsConfig - Configuration panel for Scale Numerics blocks.
 *
 * Allows users to select the scaling strategy (standard/min-max) and
 * which numeric columns to scale.
 *
 * @module components/block-configs/ScaleNumericsConfig
 */

import { ColumnMultiSelect } from "./ColumnMultiSelect";
import { configStyles, type BlockConfigProps } from "./types";

interface ScaleNumericsConfigProps extends BlockConfigProps {
  /** Whether this is the standard scaler variant (true) or min-max variant (false) */
  isStandard?: boolean;
}

/**
 * Scale Numerics block configuration panel.
 *
 * @param props - Component props
 * @returns The configuration panel
 */
export function ScaleNumericsConfig({
  params,
  onChange,
  availableColumns,
  isStandard = true,
}: ScaleNumericsConfigProps): JSX.Element {
  const strategy =
    (params.strategy as string) ?? (isStandard ? "standard" : "minmax");
  const columns = (params.columns as string[]) ?? [];

  const handleStrategyChange = (newStrategy: string): void => {
    onChange({ ...params, strategy: newStrategy });
  };

  const handleColumnsChange = (selected: string[]): void => {
    onChange({ ...params, columns: selected });
  };

  return (
    <div style={configStyles.container}>
      <h4 style={configStyles.title}>
        {isStandard ? "Standard" : "Min-Max"} Scaling Configuration
      </h4>
      <p style={configStyles.helpText}>
        {isStandard
          ? "Standardize features by removing the mean and scaling to unit variance (z-score)."
          : "Scale features to a given range, typically [0, 1]."}
      </p>

      <div style={configStyles.section}>
        <label style={configStyles.label}>Scaling Strategy</label>
        <div
          style={configStyles.radioGroup}
          role="radiogroup"
          aria-label="Scaling strategy"
        >
          <label style={configStyles.radio}>
            <input
              type="radio"
              name="strategy"
              value="standard"
              checked={strategy === "standard"}
              onChange={() => handleStrategyChange("standard")}
              style={configStyles.radioInput}
            />
            <span>Standard (z-score: mean=0, std=1)</span>
          </label>
          <label style={configStyles.radio}>
            <input
              type="radio"
              name="strategy"
              value="minmax"
              checked={strategy === "minmax"}
              onChange={() => handleStrategyChange("minmax")}
              style={configStyles.radioInput}
            />
            <span>Min-Max (range [0, 1])</span>
          </label>
        </div>
      </div>

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
          label="Numeric columns to scale"
          showSelectAll
        />
      </div>
    </div>
  );
}
