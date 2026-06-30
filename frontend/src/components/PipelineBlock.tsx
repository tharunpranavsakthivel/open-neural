/**
 * PipelineBlock component - Generic block card for the pipeline builder.
 *
 * Renders a visual card representing a single preprocessing pipeline block.
 * Displays a colored left border based on status, block type label, and
 * action buttons for configuration and removal.
 *
 * @module components/PipelineBlock
 */

/**
 * Status indicator for a pipeline block.
 */
export type BlockStatus = "configured" | "validated" | "warning" | "error";

/**
 * Pipeline block types available for building preprocessing pipelines.
 */
export type BlockType =
  | "drop_nulls"
  | "fill_missing_mean"
  | "fill_missing_median"
  | "encode_categoricals_onehot"
  | "encode_categoricals_ordinal"
  | "scale_numerics_standard"
  | "scale_numerics_minmax"
  | "log_transform"
  | "remove_outliers"
  | "feature_selection"
  | "split";

/**
 * Props for the PipelineBlock component.
 */
interface PipelineBlockProps {
  /** Unique identifier for this block instance */
  id: string;
  /** Block type identifier */
  blockType: BlockType;
  /** Human-readable display name for the block */
  label: string;
  /** Block description */
  description: string;
  /** Block-specific configuration parameters */
  params: Record<string, unknown>;
  /** Current status of the block */
  status: BlockStatus;
  /** Whether this block is currently selected */
  isSelected?: boolean;
  /** Sequential number for display (e.g., "1", "2") */
  sequenceNumber?: number;
  /** Validation error message for this block */
  errorMessage?: string;
  /** Validation warning message for this block */
  warningMessage?: string;
  /** Callback when the config button is clicked */
  onConfigure: (blockId: string) => void;
  /** Callback when the remove button is clicked */
  onRemove: (blockId: string) => void;
  /** Callback when the block is clicked for selection */
  onSelect?: (blockId: string) => void;
  /** Optional drag handle props for DnD */
  dragHandleProps?: Record<string, unknown>;
  /** Whether this block is being dragged */
  isDragging?: boolean;
}

/**
 * Maps block types to human-readable labels.
 */
const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  drop_nulls: "Drop Nulls",
  fill_missing_mean: "Fill Missing",
  fill_missing_median: "Fill Missing",
  encode_categoricals_onehot: "One-Hot Encode",
  encode_categoricals_ordinal: "Ordinal Encode",
  scale_numerics_standard: "Standard Scale",
  scale_numerics_minmax: "Min-Max Scale",
  log_transform: "Log Transform",
  remove_outliers: "Remove Outliers",
  feature_selection: "Feature Selection",
  split: "Train/Val/Test Split",
};

/**
 * Maps block types to emoji icons.
 */
const BLOCK_TYPE_ICONS: Record<BlockType, string> = {
  drop_nulls: "🗑️",
  fill_missing_mean: "📊",
  fill_missing_median: "📈",
  encode_categoricals_onehot: "🔥",
  encode_categoricals_ordinal: "🔢",
  scale_numerics_standard: "⚖️",
  scale_numerics_minmax: "📏",
  log_transform: "📉",
  remove_outliers: "✂️",
  feature_selection: "🎯",
  split: "✂️",
};

/**
 * Gets the background color for a given block status.
 *
 * @param status - The block status
 * @returns CSS color value
 */
function getStatusColor(status: BlockStatus): string {
  switch (status) {
    case "configured":
      return "#22c55e"; // green-500
    case "validated":
      return "#3b82f6"; // blue-500
    case "warning":
      return "#f59e0b"; // yellow-500
    case "error":
      return "#ef4444"; // red-500
    default:
      return "#6b7280"; // gray-500
  }
}

/**
 * Gets the status icon SVG for a given block status.
 * Returns a proper SVG element for better visual quality.
 *
 * @param status - The block status
 * @returns JSX Element for the status icon
 */
function StatusIcon({ status }: { status: BlockStatus }): JSX.Element {
  const color = getStatusColor(status);

  switch (status) {
    case "configured":
    case "validated":
      // Green checkmark
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="8"
            cy="8"
            r="7"
            stroke={color}
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M5 8L7 10L11 6"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "warning":
      // Yellow triangle
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M8 2L14 13H2L8 2Z"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M8 6V9"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="8" cy="11.5" r="0.8" fill={color} />
        </svg>
      );
    case "error":
      // Red cross
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="8"
            cy="8"
            r="7"
            stroke={color}
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M5 5L11 11M11 5L5 11"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="8"
            cy="8"
            r="7"
            stroke="#6b7280"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      );
  }
}

/**
 * Gets the status label for accessibility.
 *
 * @param status - The block status
 * @returns Human-readable status label
 */
function getStatusLabel(status: BlockStatus): string {
  switch (status) {
    case "configured":
      return "Configured";
    case "validated":
      return "Validated";
    case "warning":
      return "Warning";
    case "error":
      return "Error";
    default:
      return "Unknown";
  }
}

/**
 * Pipeline block card component.
 *
 * Renders a visual card with:
 * - Colored left border indicating block status
 * - Block type label and description
 * - Config and remove action buttons
 * - Optional drag handle for reordering
 * - Sequence number indicator
 * - Error/warning message display
 *
 * @param props - Component props
 * @returns The pipeline block card component
 */
export function PipelineBlock({
  id,
  blockType,
  label,
  description,
  params: _params,
  status,
  isSelected = false,
  sequenceNumber,
  errorMessage,
  warningMessage,
  onConfigure,
  onRemove,
  onSelect,
  dragHandleProps,
  isDragging = false,
}: PipelineBlockProps): JSX.Element {
  const statusColor = getStatusColor(status);
  const statusLabel = getStatusLabel(status);
  const blockIcon = BLOCK_TYPE_ICONS[blockType];
  const displayLabel = label || BLOCK_TYPE_LABELS[blockType];

  /**
   * Handle click on the block content area.
   */
  const handleClick = (): void => {
    if (onSelect) {
      onSelect(id);
    }
  };

  /**
   * Handle keyboard interaction for accessibility.
   */
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  };

  /**
   * Handle config button click.
   */
  const handleConfigure = (event: React.MouseEvent): void => {
    event.stopPropagation();
    onConfigure(id);
  };

  /**
   * Handle remove button click.
   */
  const handleRemove = (event: React.MouseEvent): void => {
    event.stopPropagation();
    onRemove(id);
  };

  return (
    <div
      style={{
        ...styles.blockCard,
        ...(isSelected ? styles.blockCardSelected : {}),
        ...(isDragging ? styles.blockCardDragging : {}),
        ...(status === "error" ? styles.blockCardError : {}),
      }}
      role="listitem"
      aria-selected={isSelected}
    >
      {/* Drag handle (optional) */}
      {dragHandleProps && (
        <div
          style={styles.dragHandle}
          {...(dragHandleProps as React.HTMLAttributes<HTMLDivElement>)}
          role="button"
          aria-label={`Drag to reorder ${displayLabel}`}
          title="Drag to reorder"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: "block" }}
            aria-hidden="true"
          >
            <circle cx="4" cy="4" r="1.5" fill="#9ca3af" />
            <circle cx="12" cy="4" r="1.5" fill="#9ca3af" />
            <circle cx="4" cy="8" r="1.5" fill="#9ca3af" />
            <circle cx="12" cy="8" r="1.5" fill="#9ca3af" />
            <circle cx="4" cy="12" r="1.5" fill="#9ca3af" />
            <circle cx="12" cy="12" r="1.5" fill="#9ca3af" />
          </svg>
        </div>
      )}

      {/* Sequence number indicator */}
      {sequenceNumber !== undefined && (
        <div style={styles.sequenceNumber}>{sequenceNumber}</div>
      )}

      {/* Block content */}
      <div
        style={styles.blockContent}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-pressed={isSelected}
      >
        <div style={styles.blockHeader}>
          <div style={styles.blockTitleRow}>
            <span style={styles.blockIcon} aria-hidden="true">
              {blockIcon}
            </span>
            <h3 style={styles.blockLabel}>{displayLabel}</h3>
          </div>
          <span
            style={{
              ...styles.blockStatus,
              color: statusColor,
            }}
            aria-label={`Status: ${statusLabel}`}
            title={statusLabel}
          >
            <StatusIcon status={status} />
          </span>
        </div>
        <p style={styles.blockDescription}>{description}</p>

        {/* Error message banner */}
        {errorMessage && (
          <div style={styles.errorBanner} role="alert">
            <span style={styles.errorIcon}>❌</span>
            <span style={styles.errorText}>{errorMessage}</span>
          </div>
        )}

        {/* Warning message banner */}
        {warningMessage && (
          <div style={styles.warningBanner} role="status">
            <span style={styles.warningIcon}>⚠️</span>
            <span style={styles.warningText}>{warningMessage}</span>
          </div>
        )}

        {/* Status border indicator (colored left border) */}
        <div
          style={{
            ...styles.blockStatusIndicator,
            backgroundColor: statusColor,
          }}
          aria-hidden="true"
        />
      </div>

      {/* Block actions */}
      <div style={styles.blockActions}>
        <button
          style={styles.blockActionButton}
          onClick={handleConfigure}
          type="button"
          aria-label={`Configure ${displayLabel}`}
          title="Configure"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.24 4.24l-4.24-4.24M6.34 6.34L2.1 2.1" />
          </svg>
        </button>
        <button
          style={{
            ...styles.blockActionButton,
            ...styles.blockActionButtonDanger,
          }}
          onClick={handleRemove}
          type="button"
          aria-label={`Remove ${displayLabel}`}
          title="Remove"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  blockCard: {
    display: "flex",
    alignItems: "stretch",
    backgroundColor: "#ffffff",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#e5e7eb",
    borderRadius: "8px",
    overflow: "hidden",
    transition: "all 0.15s ease",
    cursor: "pointer",
    position: "relative",
  },
  blockCardSelected: {
    borderColor: "#2563eb",
    boxShadow: "0 0 0 2px rgba(37, 99, 235, 0.1)",
  },
  blockCardDragging: {
    opacity: 0.5,
    zIndex: 1000,
  },
  blockCardError: {
    borderColor: "#ef4444",
  },
  dragHandle: {
    width: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
    borderRight: "1px solid #e5e7eb",
    cursor: "grab",
    transition: "background-color 0.15s ease",
  },
  sequenceNumber: {
    width: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
    fontSize: "0.875rem",
    fontWeight: 600,
    borderRight: "1px solid #e5e7eb",
  },
  blockContent: {
    flex: 1,
    padding: "1rem",
    minWidth: 0,
    position: "relative",
  },
  blockHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "0.25rem",
  },
  blockTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    minWidth: 0,
  },
  blockIcon: {
    fontSize: "1rem",
    flexShrink: 0,
  },
  blockLabel: {
    margin: 0,
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#374151",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  blockStatus: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    flexShrink: 0,
  },
  blockDescription: {
    margin: "0 0 0.5rem 0",
    fontSize: "0.75rem",
    color: "#6b7280",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  blockStatusIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "4px",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 0.75rem",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "4px",
    marginTop: "0.5rem",
  },
  errorIcon: {
    fontSize: "0.875rem",
    flexShrink: 0,
  },
  errorText: {
    fontSize: "0.75rem",
    color: "#dc2626",
    margin: 0,
  },
  warningBanner: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 0.75rem",
    backgroundColor: "#fffbeb",
    border: "1px solid #fcd34d",
    borderRadius: "4px",
    marginTop: "0.5rem",
  },
  warningIcon: {
    fontSize: "0.875rem",
    flexShrink: 0,
  },
  warningText: {
    fontSize: "0.75rem",
    color: "#92400e",
    margin: 0,
  },
  blockActions: {
    display: "flex",
    flexDirection: "column",
    borderLeft: "1px solid #e5e7eb",
  },
  blockActionButton: {
    flex: 1,
    padding: "0.75rem",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    color: "#6b7280",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.15s ease, color 0.15s ease",
  },
  blockActionButtonDanger: {
    color: "#ef4444",
    borderTop: "1px solid #e5e7eb",
  },
};
