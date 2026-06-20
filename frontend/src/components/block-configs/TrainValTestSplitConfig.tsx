/**
 * TrainValTestSplitConfig - Configuration panel for Train/Val/Test Split block.
 *
 * Allows users to configure the train/validation/test split ratios
 * and optionally select a stratification column.
 *
 * @module components/block-configs/TrainValTestSplitConfig
 */

import { useCallback, useMemo } from "react";
import { configStyles, type BlockConfigProps, type ColumnOption } from "./types";

interface TrainValTestSplitConfigProps extends BlockConfigProps {
  /** Target column name for stratification options */
  targetColumn?: string;
}

/**
 * Train/Val/Test Split block configuration panel.
 *
 * @param props - Component props
 * @returns The configuration panel
 */
export function TrainValTestSplitConfig({
  params,
  onChange,
  availableColumns,
  targetColumn,
}: TrainValTestSplitConfigProps): JSX.Element {
  const train = (params.train as number) ?? 0.70;
  const val = (params.val as number) ?? 0.15;
  const test = (params.test as number) ?? 0.15;
  const stratifyColumn = (params.stratify_column as string) ?? "";

  // Calculate remaining percentage for sliders
  const total = train + val + test;
  const normalizedTrain = train / total;
  const normalizedVal = val / total;
  const normalizedTest = test / total;

  // Get categorical columns for stratification
  const stratifyOptions = useMemo(() => {
    const options: ColumnOption[] = [{ value: "", label: "None (no stratification)" }];
    if (targetColumn) {
      options.push({ value: targetColumn, label: `${targetColumn} (target)`, type: "target" });
    }
    const categoricalCols = availableColumns.filter(
      (c) => c.type === "categorical" || c.type === "string"
    );
    options.push(...categoricalCols);
    return options;
  }, [availableColumns, targetColumn]);

  /**
   * Update split ratios ensuring they sum to 1.0.
   * When one slider moves, adjust the others proportionally.
   */
  const handleSplitChange = useCallback(
    (which: "train" | "val" | "test", value: number) => {
      // Clamp value to reasonable bounds
      const clampedValue = Math.max(0.05, Math.min(0.90, value));

      let newTrain = train;
      let newVal = val;
      let newTest = test;

      if (which === "train") {
        // Adjust val and test proportionally
        const remaining = 1.0 - clampedValue;
        const valRatio = val / (val + test);
        newTrain = clampedValue;
        newVal = remaining * valRatio;
        newTest = remaining * (1 - valRatio);
      } else if (which === "val") {
        // Adjust train and test proportionally
        const remaining = 1.0 - clampedValue;
        const trainRatio = train / (train + test);
        newVal = clampedValue;
        newTrain = remaining * trainRatio;
        newTest = remaining * (1 - trainRatio);
      } else {
        // Adjust train and val proportionally
        const remaining = 1.0 - clampedValue;
        const trainRatio = train / (train + val);
        newTest = clampedValue;
        newTrain = remaining * trainRatio;
        newVal = remaining * (1 - trainRatio);
      }

      // Normalize to ensure exact sum of 1.0
      const sum = newTrain + newVal + newTest;
      onChange({
        ...params,
        train: Math.round((newTrain / sum) * 100) / 100,
        val: Math.round((newVal / sum) * 100) / 100,
        test: Math.round((newTest / sum) * 100) / 100,
      });
    },
    [train, val, test, params, onChange]
  );

  const handleStratifyChange = (value: string): void => {
    onChange({
      ...params,
      stratify_column: value === "" ? undefined : value,
    });
  };

  return (
    <div style={configStyles.container}>
      <h4 style={configStyles.title}>Train/Val/Test Split Configuration</h4>
      <p style={configStyles.helpText}>
        Split your data into training, validation, and test sets. The training set
        is used to train the model, validation for hyperparameter tuning, and test
        for final evaluation.
      </p>

      {/* Train slider */}
      <div style={configStyles.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={configStyles.label}>Training Set</label>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>
            {Math.round(normalizedTrain * 100)}%
          </span>
        </div>
        <div style={configStyles.sliderContainer}>
          <input
            type="range"
            min="0.50"
            max="0.90"
            step="0.05"
            value={normalizedTrain}
            onChange={(e) => handleSplitChange("train", parseFloat(e.target.value))}
            style={configStyles.slider}
            aria-label="Training set percentage"
          />
          <div style={configStyles.sliderLabels}>
            <span>50%</span>
            <span>90%</span>
          </div>
        </div>
      </div>

      {/* Validation slider */}
      <div style={configStyles.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={configStyles.label}>Validation Set</label>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>
            {Math.round(normalizedVal * 100)}%
          </span>
        </div>
        <div style={configStyles.sliderContainer}>
          <input
            type="range"
            min="0.05"
            max="0.30"
            step="0.05"
            value={normalizedVal}
            onChange={(e) => handleSplitChange("val", parseFloat(e.target.value))}
            style={configStyles.slider}
            aria-label="Validation set percentage"
          />
          <div style={configStyles.sliderLabels}>
            <span>5%</span>
            <span>30%</span>
          </div>
        </div>
      </div>

      {/* Test slider */}
      <div style={configStyles.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={configStyles.label}>Test Set</label>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>
            {Math.round(normalizedTest * 100)}%
          </span>
        </div>
        <div style={configStyles.sliderContainer}>
          <input
            type="range"
            min="0.05"
            max="0.30"
            step="0.05"
            value={normalizedTest}
            onChange={(e) => handleSplitChange("test", parseFloat(e.target.value))}
            style={configStyles.slider}
            aria-label="Test set percentage"
          />
          <div style={configStyles.sliderLabels}>
            <span>5%</span>
            <span>30%</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1rem",
          padding: "0.75rem",
          backgroundColor: "#f3f4f6",
          borderRadius: "6px",
        }}
      >
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Train</div>
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "#22c55e" }}>
            {Math.round(normalizedTrain * 100)}%
          </div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Val</div>
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "#3b82f6" }}>
            {Math.round(normalizedVal * 100)}%
          </div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Test</div>
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "#f59e0b" }}>
            {Math.round(normalizedTest * 100)}%
          </div>
        </div>
      </div>

      {/* Stratification */}
      <div style={configStyles.section}>
        <label style={configStyles.label} htmlFor="stratify-select">
          Stratify By (optional)
        </label>
        <select
          id="stratify-select"
          value={stratifyColumn}
          onChange={(e) => handleStratifyChange(e.target.value)}
          style={configStyles.select}
        >
          {stratifyOptions.map((col) => (
            <option key={col.value} value={col.value}>
              {col.label}
              {col.type ? ` (${col.type})` : ""}
            </option>
          ))}
        </select>
        <p style={configStyles.helpText}>
          Stratification ensures each split has the same distribution of the selected column.
          Recommended for classification tasks.
        </p>
      </div>
    </div>
  );
}
