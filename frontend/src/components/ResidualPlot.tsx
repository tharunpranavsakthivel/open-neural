/**
 * ResidualPlot component - Renders a scatter plot of residuals vs predicted values.
 *
 * For regression tasks, displays residuals (prediction errors) on the y-axis
 * versus predicted values on the x-axis. Includes a zero-residual reference line
 * to visualize bias and variance in predictions.
 *
 * Implemented using native SVG for zero additional dependencies.
 *
 * @module components/ResidualPlot
 */

/**
 * Data point for residual plot.
 */
export interface ResidualDataPoint {
  /** Predicted value from the model */
  predicted: number;
  /** Residual (actual - predicted) */
  residual: number;
  /** Optional actual value for tooltip */
  actual?: number;
}

/**
 * Props for the ResidualPlot component.
 */
interface ResidualPlotProps {
  /** Array of data points with predicted values and residuals */
  data: ResidualDataPoint[];
  /** Width of the plot in pixels */
  width?: number;
  /** Height of the plot in pixels */
  height?: number;
  /** Margin around the plot area */
  margin?: { top: number; right: number; bottom: number; left: number };
}

/**
 * Calculate statistics for data ranges.
 */
function calculateStats(data: ResidualDataPoint[]) {
  if (data.length === 0) {
    return {
      xMin: 0,
      xMax: 1,
      yMin: -1,
      yMax: 1,
      yRange: 2,
      xRange: 1,
    };
  }

  const predicted = data.map((d) => d.predicted);
  const residuals = data.map((d) => d.residual);

  const xMin = Math.min(...predicted);
  const xMax = Math.max(...predicted);
  const yMin = Math.min(...residuals);
  const yMax = Math.max(...residuals);

  // Add padding to ranges
  const xPadding = (xMax - xMin) * 0.05 || xMax * 0.1;
  const yPadding = (yMax - yMin) * 0.05 || Math.abs(yMax) * 0.1;

  return {
    xMin: xMin - xPadding,
    xMax: xMax + xPadding,
    yMin: yMin - yPadding,
    yMax: yMax + yPadding,
    yRange: yMax - yMin + 2 * yPadding,
    xRange: xMax - xMin + 2 * xPadding,
  };
}

/**
 * Format number for axis labels.
 */
function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000) {
    return value.toExponential(1);
  }
  if (Math.abs(value) >= 1) {
    return value.toFixed(2);
  }
  return value.toFixed(3);
}

/**
 * Residual plot component.
 *
 * Renders an SVG scatter plot showing residuals vs predicted values.
 * Includes a horizontal zero-residual reference line.
 *
 * @param props - Component props
 * @returns The residual plot component
 */
export function ResidualPlot({
  data,
  width = 500,
  height = 350,
  margin = { top: 20, right: 30, bottom: 50, left: 60 },
}: ResidualPlotProps): JSX.Element {
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const stats = calculateStats(data);
  const { xMin, xMax, yMin, yMax, yRange, xRange } = stats;

  /**
   * Scale functions to map data coordinates to SVG coordinates.
   */
  const scaleX = (value: number): number => {
    return margin.left + ((value - xMin) / xRange) * plotWidth;
  };

  const scaleY = (value: number): number => {
    return margin.top + plotHeight - ((value - yMin) / yRange) * plotHeight;
  };

  /**
   * Generate tick marks for axes.
   */
  const generateTicks = (
    min: number,
    max: number,
    count: number
  ): number[] => {
    const ticks: number[] = [];
    const step = (max - min) / count;
    for (let i = 0; i <= count; i++) {
      ticks.push(min + step * i);
    }
    return ticks;
  };

  const xTicks = generateTicks(xMin, xMax, 6);
  const yTicks = generateTicks(yMin, yMax, 5);

  /**
   * Calculate point color based on residual magnitude.
   */
  const getPointColor = (residual: number): string => {
    const absResidual = Math.abs(residual);
    const normalized =
      stats.yRange > 0 ? absResidual / (stats.yRange / 2) : 0;

    if (normalized < 0.3) {
      return "#22c55e"; // Green for small residuals
    } else if (normalized < 0.7) {
      return "#f59e0b"; // Orange for medium residuals
    } else {
      return "#ef4444"; // Red for large residuals
    }
  };

  /**
   * Calculate point radius based on data density.
   */
  const pointRadius = Math.max(2, Math.min(5, 200 / Math.sqrt(data.length)));

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Residual Plot</span>
        <span style={styles.subtitle}>{data.length.toLocaleString()} points</span>
      </div>

      <svg
        width={width}
        height={height}
        style={styles.svg}
        role="img"
        aria-label="Residual plot showing residuals vs predicted values"
      >
        {/* Background */}
        <rect
          x={margin.left}
          y={margin.top}
          width={plotWidth}
          height={plotHeight}
          fill="#f9fafb"
          stroke="#e5e7eb"
          strokeWidth={1}
        />

        {/* Grid lines - horizontal */}
        {yTicks.map((tick, index) => (
          <line
            key={`hgrid-${index}`}
            x1={margin.left}
            y1={scaleY(tick)}
            x2={margin.left + plotWidth}
            y2={scaleY(tick)}
            stroke="#e5e7eb"
            strokeWidth={1}
            strokeDasharray={tick === 0 ? "none" : "2,2"}
          />
        ))}

        {/* Grid lines - vertical */}
        {xTicks.map((tick, index) => (
          <line
            key={`vgrid-${index}`}
            x1={scaleX(tick)}
            y1={margin.top}
            x2={scaleX(tick)}
            y2={margin.top + plotHeight}
            stroke="#e5e7eb"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        ))}

        {/* Zero residual reference line */}
        <line
          x1={margin.left}
          y1={scaleY(0)}
          x2={margin.left + plotWidth}
          y2={scaleY(0)}
          stroke="#dc2626"
          strokeWidth={2}
          strokeDasharray="5,5"
          aria-label="Zero residual reference line"
        />
        <text
          x={margin.left + plotWidth - 5}
          y={scaleY(0) - 8}
          textAnchor="end"
          fontSize="10"
          fill="#dc2626"
          fontWeight={500}
        >
          Zero residual
        </text>

        {/* Scatter plot points */}
        {data.map((point, index) => {
          const cx = scaleX(point.predicted);
          const cy = scaleY(point.residual);

          return (
            <circle
              key={index}
              cx={cx}
              cy={cy}
              r={pointRadius}
              fill={getPointColor(point.residual)}
              fillOpacity={0.6}
              stroke="none"
              style={{ cursor: "pointer" }}
              aria-label={`Predicted: ${point.predicted.toFixed(3)}, Residual: ${point.residual.toFixed(3)}`}
            >
              <title>
                {`Predicted: ${point.predicted.toFixed(4)}
Actual: ${point.actual?.toFixed(4) ?? "N/A"}
Residual: ${point.residual.toFixed(4)}`}
              </title>
            </circle>
          );
        })}

        {/* X-axis */}
        <line
          x1={margin.left}
          y1={margin.top + plotHeight}
          x2={margin.left + plotWidth}
          y2={margin.top + plotHeight}
          stroke="#374151"
          strokeWidth={2}
        />

        {/* Y-axis */}
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + plotHeight}
          stroke="#374151"
          strokeWidth={2}
        />

        {/* X-axis label */}
        <text
          x={margin.left + plotWidth / 2}
          y={height - 10}
          textAnchor="middle"
          fontSize="12"
          fontWeight={600}
          fill="#374151"
        >
          Predicted Value
        </text>

        {/* Y-axis label */}
        <text
          x={15}
          y={margin.top + plotHeight / 2}
          textAnchor="middle"
          fontSize="12"
          fontWeight={600}
          fill="#374151"
          transform={`rotate(-90, 15, ${margin.top + plotHeight / 2})`}
        >
          Residual (Actual - Predicted)
        </text>

        {/* X-axis ticks and labels */}
        {xTicks.map((tick, index) => (
          <g key={`xtick-${index}`}>
            <line
              x1={scaleX(tick)}
              y1={margin.top + plotHeight}
              x2={scaleX(tick)}
              y2={margin.top + plotHeight + 5}
              stroke="#374151"
              strokeWidth={1}
            />
            <text
              x={scaleX(tick)}
              y={margin.top + plotHeight + 20}
              textAnchor="middle"
              fontSize="10"
              fill="#6b7280"
              fontFamily="monospace"
            >
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        {/* Y-axis ticks and labels */}
        {yTicks.map((tick, index) => (
          <g key={`ytick-${index}`}>
            <line
              x1={margin.left - 5}
              y1={scaleY(tick)}
              x2={margin.left}
              y2={scaleY(tick)}
              stroke="#374151"
              strokeWidth={1}
            />
            <text
              x={margin.left - 10}
              y={scaleY(tick) + 4}
              textAnchor="end"
              fontSize="10"
              fill="#6b7280"
              fontFamily="monospace"
            >
              {formatNumber(tick)}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div
            style={{
              ...styles.legendDot,
              backgroundColor: "#22c55e",
            }}
          />
          <span style={styles.legendText}>Small residual</span>
        </div>
        <div style={styles.legendItem}>
          <div
            style={{
              ...styles.legendDot,
              backgroundColor: "#f59e0b",
            }}
          />
          <span style={styles.legendText}>Medium residual</span>
        </div>
        <div style={styles.legendItem}>
          <div
            style={{
              ...styles.legendDot,
              backgroundColor: "#ef4444",
            }}
          />
          <span style={styles.legendText}>Large residual</span>
        </div>
        <div style={styles.legendSeparator} />
        <div style={styles.legendItem}>
          <div
            style={{
              ...styles.legendLine,
              background: "repeating-linear-gradient(90deg, #dc2626, #dc2626 5px, transparent 5px, transparent 10px)",
            }}
          />
          <span style={styles.legendText}>Zero residual</span>
        </div>
      </div>

      {/* Statistics */}
      <div style={styles.stats}>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>Mean Residual:</span>
          <span style={styles.statValue}>
            {data.length > 0
              ? (
                  data.reduce((sum, d) => sum + d.residual, 0) / data.length
                ).toFixed(4)
              : "N/A"}
          </span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>Std Dev:</span>
          <span style={styles.statValue}>
            {data.length > 1
              ? Math.sqrt(
                  data.reduce((sum, d) => {
                    const mean =
                      data.reduce((s, p) => s + p.residual, 0) / data.length;
                    return sum + Math.pow(d.residual - mean, 2);
                  }, 0) /
                    (data.length - 1)
                ).toFixed(4)
              : "N/A"}
          </span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    padding: "1rem",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.5rem",
  },
  title: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  subtitle: {
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  svg: {
    display: "block",
    maxWidth: "100%",
    height: "auto",
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "1rem",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.75rem",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  legendDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
  },
  legendLine: {
    width: "20px",
    height: "2px",
  },
  legendText: {
    fontSize: "0.75rem",
    color: "#374151",
  },
  legendSeparator: {
    width: "1px",
    height: "16px",
    backgroundColor: "#d1d5db",
  },
  stats: {
    display: "flex",
    justifyContent: "center",
    gap: "2rem",
    padding: "0.75rem",
    backgroundColor: "#f3f4f6",
    borderRadius: "6px",
    flexWrap: "wrap",
  },
  statItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  statLabel: {
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  statValue: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#111827",
    fontFamily: "monospace",
  },
};
