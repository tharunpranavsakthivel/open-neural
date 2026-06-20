/**
 * EncodeCategoricalsConfig - Configuration panel for Encode Categoricals blocks.
 *
 * Allows users to select the encoding strategy (one-hot/ordinal) and
 * which categorical columns to encode.
 *
 * @module components/block-configs/EncodeCategoricalsConfig
 */

import { ColumnMultiSelect } from "./ColumnMultiSelect";
import { configStyles, type BlockConfigProps } from "./types";

interface EncodeCategoricalsConfigProps extends BlockConfigProps {
  /** Whether this is the one-hot variant (true) or ordinal variant (false) */
  isOneHot?: boolean;
}

/**
 * Encode Categoricals block configuration panel.
 *
 * @param props - Component props
 * @returns The configuration panel
 */
export function EncodeCategoricalsConfig({
  params,
  onChange,
  availableColumns,
  isOneHot = true,
}: EncodeCategoricalsConfigProps): JSX.Element {
  const strategy = (params.strategy as string) ?? (isOneHot ? "onehot" : "ordinal");
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
        {isOneHot ? "One-Hot" : "Ordinal"} Encoding Configuration
      </h4>
      <p style={configStyles.helpText}>
        {isOneHot
          ? "Convert categorical columns to binary columns (0/1) for each category."
          : "Convert categorical columns to integer values based on category order."}
      </p>

      <div style={configStyles.section}>
        <label style={configStyles.label}>Encoding Strategy</label>
        <div style={configStyles.radioGroup} role="radiogroup" aria-label="Encoding strategy">
          <label style={configStyles.radio}>
            <input
              type="radio"
              name="strategy"
              value="onehot"
              checked={strategy === "onehot"}
              onChange={() => handleStrategyChange("onehot")}
              style={configStyles.radioInput}
            />
            <span>One-Hot (binary columns)</span>
          </label>
          <label style={configStyles.radio}>
            <input
              type="radio"
              name="strategy"
              value="ordinal"
              checked={strategy === "ordinal"}
              onChange={() => handleStrategyChange("ordinal")}
              style={configStyles.radioInput}
            />
            <span>Ordinal (integer values)</span>
          </label>
        </div>
      </div>

      <div style={configStyles.section}>
        <ColumnMultiSelect
          columns={availableColumns.filter((c) => c.type === "categorical" || c.type === "string")}
          selected={columns}
          onChange={handleColumnsChange}
          label="Categorical columns to encode"
          showSelectAll
        />
      </div>
    </div>
  );
}
