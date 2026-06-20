/**
 * FillMissingConfig - Configuration panel for Fill Missing blocks.
 *
 * Allows users to select the imputation strategy (mean/median) and
 * which columns to apply it to.
 *
 * @module components/block-configs/FillMissingConfig
 */

import { ColumnMultiSelect } from "./ColumnMultiSelect";
import { configStyles, type BlockConfigProps } from "./types";

interface FillMissingConfigProps extends BlockConfigProps {
  /** Whether this is the mean variant (true) or median variant (false) */
  isMean?: boolean;
}

/**
 * Fill Missing block configuration panel.
 *
 * @param props - Component props
 * @returns The configuration panel
 */
export function FillMissingConfig({
  params,
  onChange,
  availableColumns,
  isMean = true,
}: FillMissingConfigProps): JSX.Element {
  const strategy = (params.strategy as string) ?? (isMean ? "mean" : "median");
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
        Fill Missing ({isMean ? "Mean" : "Median"}) Configuration
      </h4>
      <p style={configStyles.helpText}>
        Impute missing values using the {isMean ? "mean" : "median"} of each column.
      </p>

      <div style={configStyles.section}>
        <label style={configStyles.label}>Imputation Strategy</label>
        <div style={configStyles.radioGroup} role="radiogroup" aria-label="Imputation strategy">
          <label style={configStyles.radio}>
            <input
              type="radio"
              name="strategy"
              value="mean"
              checked={strategy === "mean"}
              onChange={() => handleStrategyChange("mean")}
              style={configStyles.radioInput}
            />
            <span>Mean (average)</span>
          </label>
          <label style={configStyles.radio}>
            <input
              type="radio"
              name="strategy"
              value="median"
              checked={strategy === "median"}
              onChange={() => handleStrategyChange("median")}
              style={configStyles.radioInput}
            />
            <span>Median (middle value)</span>
          </label>
        </div>
      </div>

      <div style={configStyles.section}>
        <ColumnMultiSelect
          columns={availableColumns.filter((c) => c.type === "numeric" || c.type === "integer" || c.type === "float")}
          selected={columns}
          onChange={handleColumnsChange}
          label="Numeric columns to fill"
          showSelectAll
        />
      </div>
    </div>
  );
}
