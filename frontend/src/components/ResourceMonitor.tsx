/**
 * ResourceMonitor component - Displays real-time CPU and RAM usage.
 *
 * Renders two horizontal progress bars showing system resource utilization
 * during training:
 * - CPU: Shows usage percentage with color-coded bar
 * - RAM: Shows used GB / total GB with visual progress indicator
 *
 * Values update in real-time from SSE payload updates. The component
 * automatically formats values for display and handles edge cases like
 * zero total RAM.
 *
 * @module components/ResourceMonitor
 */

/**
 * Props for the ResourceMonitor component.
 */
interface ResourceMonitorProps {
  /** CPU usage percentage (0-100) */
  cpuPct: number;
  /** RAM used in GB */
  ramUsedGb: number;
  /** Total RAM in GB */
  ramTotalGb: number;
}

/**
 * Format a number to one decimal place.
 *
 * @param value - The number to format
 * @returns Formatted string with 1 decimal place
 */
function formatOneDecimal(value: number): string {
  if (!isFinite(value) || isNaN(value)) {
    return "0.0";
  }
  return value.toFixed(1);
}

/**
 * Clamp a value between min and max.
 *
 * @param value - The value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Get color for CPU usage bar based on percentage.
 *
 * @param pct - CPU percentage
 * @returns Color hex code
 */
function getCpuColor(pct: number): string {
  if (pct >= 80) return "#ef4444"; // Red for high usage
  if (pct >= 60) return "#f59e0b"; // Orange for medium-high usage
  return "#2563eb"; // Blue for normal usage
}

/**
 * Get color for RAM usage bar based on percentage.
 *
 * @param pct - RAM percentage
 * @returns Color hex code
 */
function getRamColor(pct: number): string {
  if (pct >= 85) return "#ef4444"; // Red for high usage
  if (pct >= 70) return "#f59e0b"; // Orange for medium-high usage
  return "#2563eb"; // Blue for normal usage
}

/**
 * Resource monitor component.
 *
 * Displays CPU and RAM usage with horizontal progress bars.
 * Updates in real-time from SSE payload data.
 *
 * @param props - Component props
 * @returns The resource monitor component
 */
export function ResourceMonitor({
  cpuPct,
  ramUsedGb,
  ramTotalGb,
}: ResourceMonitorProps): JSX.Element {
  /**
   * Clamp CPU percentage to valid range.
   */
  const clampedCpu = clamp(cpuPct, 0, 100);

  /**
   * Calculate RAM percentage safely.
   */
  const ramPercentage = ramTotalGb > 0 ? (ramUsedGb / ramTotalGb) * 100 : 0;
  const clampedRam = clamp(ramPercentage, 0, 100);

  /**
   * Get colors for progress bars.
   */
  const cpuColor = getCpuColor(clampedCpu);
  const ramColor = getRamColor(clampedRam);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Resource Usage</h2>

      <div style={styles.barsContainer}>
        {/* CPU Usage Bar */}
        <div style={styles.resourceRow}>
          <div style={styles.labelRow}>
            <span style={styles.label}>CPU</span>
            <span style={styles.value}>{clampedCpu.toFixed(1)}%</span>
          </div>
          <div style={styles.progressContainer}>
            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${clampedCpu}%`,
                  backgroundColor: cpuColor,
                }}
              />
            </div>
          </div>
        </div>

        {/* RAM Usage Bar */}
        <div style={styles.resourceRow}>
          <div style={styles.labelRow}>
            <span style={styles.label}>RAM</span>
            <span style={styles.value}>
              {formatOneDecimal(ramUsedGb)} / {formatOneDecimal(ramTotalGb)} GB
            </span>
          </div>
          <div style={styles.progressContainer}>
            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${clampedRam}%`,
                  backgroundColor: ramColor,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Warning for high resource usage */}
      {clampedCpu >= 80 && (
        <div style={styles.warningContainer}>
          <span style={styles.warningIcon}>⚠</span>
          <span style={styles.warningText}>
            High CPU usage detected. Training may slow down other applications.
          </span>
        </div>
      )}
      {clampedRam >= 85 && (
        <div style={styles.warningContainer}>
          <span style={styles.warningIcon}>⚠</span>
          <span style={styles.warningText}>
            High RAM usage detected. Close other applications to improve
            training performance.
          </span>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.5rem",
  },
  title: {
    margin: "0 0 1.25rem 0",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  barsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  resourceRow: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  labelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
    minWidth: "40px",
  },
  value: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#111827",
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  progressContainer: {
    width: "100%",
  },
  progressTrack: {
    width: "100%",
    height: "10px",
    backgroundColor: "#e5e7eb",
    borderRadius: "5px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "5px",
    transition: "width 0.3s ease, background-color 0.3s ease",
  },
  warningContainer: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
    marginTop: "1rem",
    padding: "0.75rem",
    backgroundColor: "#fef3c7",
    border: "1px solid #fcd34d",
    borderRadius: "6px",
  },
  warningIcon: {
    fontSize: "1rem",
    flexShrink: 0,
  },
  warningText: {
    fontSize: "0.75rem",
    color: "#92400e",
    lineHeight: 1.5,
  },
};
