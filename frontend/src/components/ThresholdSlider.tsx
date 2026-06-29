/**
 * ThresholdSlider component - Renders a threshold slider with debounced updates.
 *
 * Displays a range input from 0.10 to 0.90 with step 0.05 for binary classification
 * decision threshold adjustment. On change, debounced to 100ms, calls the API
 * to update metrics. Updates Precision, Recall, and F1 metric cards in real time.
 * Displays the current threshold value as a label above the slider.
 *
 * Total update latency is kept ≤ 200ms for responsive UX.
 *
 * @module components/ThresholdSlider
 */
import { useState, useCallback, useRef, useEffect } from "react";
import {
  updateEvaluationThreshold,
  type UpdateThresholdResponse,
} from "../utils/api";

/**
 * Props for the ThresholdSlider component.
 */
interface ThresholdSliderProps {
  /** Experiment ID for API calls */
  experimentId: string;
  /** Initial threshold value (0.10-0.90) */
  initialThreshold?: number;
  /** Callback when threshold changes (with debounce) */
  onThresholdChange?: (threshold: number) => void;
  /** Callback when metrics are updated from API */
  onMetricsUpdate?: (metrics: UpdateThresholdResponse) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/**
 * Debounce delay in milliseconds for API calls.
 * @constant {number}
 */
const DEBOUNCE_DELAY_MS = 100;

/**
 * Maximum allowed update latency in milliseconds.
 * @constant {number}
 */
const MAX_UPDATE_LATENCY_MS = 200;

/**
 * Threshold slider component.
 *
 * Renders a range input with debounced API calls to update classification
 * metrics based on the decision threshold. Shows current threshold value
 * and provides visual feedback during updates.
 *
 * @param props - Component props
 * @returns The threshold slider component
 */
export function ThresholdSlider({
  experimentId,
  initialThreshold = 0.5,
  onThresholdChange,
  onMetricsUpdate,
  disabled = false,
}: ThresholdSliderProps): JSX.Element {
  /** Current threshold value (local state for immediate UI updates) */
  const [threshold, setThreshold] = useState(initialThreshold);
  /** Whether an API call is in progress */
  const [isUpdating, setIsUpdating] = useState(false);
  /** Error message if API call fails */
  const [error, setError] = useState<string | null>(null);
  /** Debounce timer reference */
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  /** Track request start time for latency measurement */
  const requestStartTimeRef = useRef<number>(0);

  /**
   * Update threshold value immediately and debounce API call.
   *
   * Clears existing timer, updates local state immediately for responsive UI,
   * then schedules API call after debounce delay.
   *
   * @param newThreshold - The new threshold value
   */
  const handleThresholdChange = useCallback(
    (newThreshold: number) => {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // Update local state immediately for responsive UI
      setThreshold(newThreshold);
      setError(null);

      // Notify parent of threshold change
      onThresholdChange?.(newThreshold);

      // Debounce API call
      debounceTimerRef.current = setTimeout(async () => {
        // Track request start time for latency measurement
        requestStartTimeRef.current = performance.now();
        setIsUpdating(true);

        try {
          const updatedMetrics = await updateEvaluationThreshold(
            experimentId,
            newThreshold,
          );

          // Check latency constraint
          const latency = performance.now() - requestStartTimeRef.current;
          if (latency > MAX_UPDATE_LATENCY_MS) {
            console.warn(
              `Threshold update latency (${latency.toFixed(1)}ms) exceeded ${MAX_UPDATE_LATENCY_MS}ms target`,
            );
          }

          // Notify parent of updated metrics
          onMetricsUpdate?.(updatedMetrics);
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to update threshold";
          setError(errorMessage);
          console.error("Threshold update failed:", err);
        } finally {
          setIsUpdating(false);
        }
      }, DEBOUNCE_DELAY_MS);
    },
    [experimentId, onThresholdChange, onMetricsUpdate],
  );

  /**
   * Cleanup debounce timer on unmount.
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Sync with initial threshold prop changes.
   */
  useEffect(() => {
    setThreshold(initialThreshold);
  }, [initialThreshold]);

  /**
   * Generate slider tick marks for visual guidance.
   */
  const generateTicks = (): number[] => {
    const ticks: number[] = [];
    for (let i = 0.1; i <= 0.9; i += 0.1) {
      ticks.push(Math.round(i * 100) / 100);
    }
    return ticks;
  };

  const ticks = generateTicks();

  return (
    <div style={styles.container}>
      {/* Threshold Label Header */}
      <div style={styles.header}>
        <div style={styles.labelSection}>
          <span style={styles.label}>Decision Threshold</span>
          <span
            style={{
              ...styles.valueDisplay,
              ...(isUpdating ? styles.valueDisplayUpdating : {}),
            }}
          >
            {threshold.toFixed(2)}
          </span>
        </div>
        {isUpdating && (
          <span style={styles.updatingIndicator}>Updating...</span>
        )}
      </div>

      {/* Slider Container */}
      <div style={styles.sliderContainer}>
        {/* Range Input */}
        <input
          type="range"
          min={0.1}
          max={0.9}
          step={0.05}
          value={threshold}
          onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
          disabled={disabled || isUpdating}
          style={styles.slider}
          aria-label="Decision threshold"
          aria-valuemin={0.1}
          aria-valuemax={0.9}
          aria-valuenow={threshold}
          aria-valuetext={`Threshold: ${threshold.toFixed(2)}`}
        />

        {/* Tick Marks */}
        <div style={styles.ticksContainer}>
          {ticks.map((tick) => (
            <div key={tick} style={styles.tick}>
              <div
                style={{
                  ...styles.tickLine,
                  ...(tick === 0.5 ? styles.tickLineMiddle : {}),
                }}
              />
              <span style={styles.tickLabel}>{tick.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Range Labels */}
      <div style={styles.rangeLabels}>
        <span style={styles.rangeLabel}>0.10</span>
        <span style={styles.rangeLabel}>0.50</span>
        <span style={styles.rangeLabel}>0.90</span>
      </div>

      {/* Help Text */}
      <p style={styles.helpText}>
        Adjust the threshold to change the trade-off between Precision and
        Recall. Higher thresholds favor Precision, lower thresholds favor
        Recall.
      </p>

      {/* Error Message */}
      {error && (
        <div style={styles.errorContainer}>
          <span style={styles.errorIcon}>⚠</span>
          <span style={styles.errorText}>{error}</span>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.25rem",
  },
  labelSection: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#374151",
  },
  valueDisplay: {
    fontSize: "1.125rem",
    fontWeight: 700,
    color: "#111827",
    fontFamily: "monospace",
    padding: "0.25rem 0.5rem",
    backgroundColor: "#f3f4f6",
    borderRadius: "4px",
    border: "1px solid #e5e7eb",
    transition: "all 0.2s ease",
  },
  valueDisplayUpdating: {
    backgroundColor: "#dbeafe",
    borderColor: "#60a5fa",
  },
  updatingIndicator: {
    fontSize: "0.75rem",
    color: "#2563eb",
    fontStyle: "italic",
  },
  sliderContainer: {
    position: "relative",
    padding: "0.5rem 0",
  },
  slider: {
    width: "100%",
    height: "24px",
    WebkitAppearance: "none",
    appearance: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    outline: "none",
  } as React.CSSProperties,
  ticksContainer: {
    position: "absolute",
    top: "50%",
    left: "0",
    right: "0",
    transform: "translateY(-50%)",
    display: "flex",
    justifyContent: "space-between",
    pointerEvents: "none",
    padding: "0 2px",
    zIndex: 0,
  },
  tick: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
  tickLine: {
    width: "1px",
    height: "8px",
    backgroundColor: "#d1d5db",
  },
  tickLineMiddle: {
    backgroundColor: "#9ca3af",
    width: "2px",
  },
  tickLabel: {
    fontSize: "0.625rem",
    color: "#9ca3af",
    fontFamily: "monospace",
  },
  rangeLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.75rem",
    color: "#6b7280",
    fontFamily: "monospace",
  },
  rangeLabel: {},
  helpText: {
    margin: "0.5rem 0 0 0",
    fontSize: "0.75rem",
    color: "#6b7280",
    lineHeight: 1.4,
    fontStyle: "italic",
  },
  errorContainer: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "4px",
    marginTop: "0.5rem",
  },
  errorIcon: {
    fontSize: "0.875rem",
    color: "#dc2626",
  },
  errorText: {
    fontSize: "0.75rem",
    color: "#991b1b",
  },
};
