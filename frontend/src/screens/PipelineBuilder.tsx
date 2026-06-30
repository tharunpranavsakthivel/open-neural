/**
 * PipelineBuilder screen - Step 2: Visual preprocessing pipeline builder.
 *
 * Allows users to build a preprocessing pipeline by arranging visual blocks.
 * Displays a step description, a vertical list of pipeline blocks, and a
 * block palette for adding new blocks. Supports drag-and-drop reordering
 * of blocks using @dnd-kit and inline configuration panels.
 *
 * Features:
 * - Block validation with error/warning display (Task 158)
 * - Pipeline save with API integration (Task 159)
 * - Pipeline reuse with saved pipelines dropdown (Task 160)
 * - Per-block status indicators (Task 161)
 *
 * @module screens/PipelineBuilder
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  PipelineBlock,
  type BlockType,
  type BlockStatus,
} from "../components/PipelineBlock";
import {
  DropNullsConfig,
  FillMissingConfig,
  EncodeCategoricalsConfig,
  ScaleNumericsConfig,
  LogTransformConfig,
  RemoveOutliersConfig,
  FeatureSelectionConfig,
  TrainValTestSplitConfig,
  type ColumnOption,
} from "../components/block-configs";
import {
  createPipeline,
  fetchProjectPipelines,
  validatePipelineConfig,
  fetchProjectSnapshots,
  fetchSnapshotDetails,
  type PipelineValidationResult,
  type PipelineResponse,
} from "../utils/api";
import { useAppStore } from "../stores/appStore";
import { usePipelineStore } from "../stores/pipelineStore";

interface PipelineBuilderProps {
  /** Currently selected project ID */
  projectId: string;
  /** Callback when pipeline is saved and ready to proceed */
  onComplete?: () => void;
}

/**
 * Pipeline block data structure used internally by PipelineBuilder.
 */
interface PipelineBlockData {
  /** Unique identifier for this block instance */
  id: string;
  /** Block type identifier */
  type: BlockType;
  /** Human-readable display name */
  name: string;
  /** Block description */
  description: string;
  /** Current status of the block */
  status: BlockStatus;
  /** Block-specific configuration parameters */
  params: Record<string, unknown>;
  /** Validation error message for this block */
  errorMessage?: string;
  /** Validation warning message for this block */
  warningMessage?: string;
}

/**
 * Block palette item definition.
 */
interface BlockPaletteItem {
  /** Block type identifier */
  type: BlockType;
  /** Human-readable display name */
  name: string;
  /** Block description */
  description: string;
  /** Icon emoji for visual identification */
  icon: string;
}

/**
 * Available blocks in the palette for users to add to their pipeline.
 * Organized by category for better discoverability.
 */
const BLOCK_PALETTE: BlockPaletteItem[] = [
  // Data Cleaning
  {
    type: "drop_nulls",
    name: "Drop Nulls",
    description: "Remove rows with null values",
    icon: "🗑️",
  },
  {
    type: "fill_missing_mean",
    name: "Fill Missing (Mean)",
    description: "Impute missing values with column mean",
    icon: "📊",
  },
  {
    type: "fill_missing_median",
    name: "Fill Missing (Median)",
    description: "Impute missing values with column median",
    icon: "📈",
  },
  {
    type: "remove_outliers",
    name: "Remove Outliers",
    description: "Filter rows outside IQR range",
    icon: "✂️",
  },

  // Feature Encoding
  {
    type: "encode_categoricals_onehot",
    name: "One-Hot Encode",
    description: "One-hot encoding for categorical columns",
    icon: "🔥",
  },
  {
    type: "encode_categoricals_ordinal",
    name: "Ordinal Encode",
    description: "Ordinal encoding for categorical columns",
    icon: "🔢",
  },

  // Feature Scaling
  {
    type: "scale_numerics_standard",
    name: "Standard Scale",
    description: "Standardize numeric features (z-score)",
    icon: "⚖️",
  },
  {
    type: "scale_numerics_minmax",
    name: "Min-Max Scale",
    description: "Scale numeric features to [0,1] range",
    icon: "📏",
  },
  {
    type: "log_transform",
    name: "Log Transform",
    description: "Apply log transformation to numeric columns",
    icon: "📉",
  },

  // Feature Selection
  {
    type: "feature_selection",
    name: "Feature Selection",
    description: "Drop specified columns from the dataset",
    icon: "🎯",
  },

  // Data Split
  {
    type: "split",
    name: "Train/Val/Test Split",
    description: "Split data into train/validation/test sets",
    icon: "✂️",
  },
];

/**
 * Generates a unique ID for pipeline blocks.
 */
function generateBlockId(type: BlockType): string {
  return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Map block type to the appropriate config component.
 */
function getBlockConfigComponent(
  blockType: BlockType,
  props: {
    params: Record<string, unknown>;
    onChange: (params: Record<string, unknown>) => void;
    availableColumns: ColumnOption[];
  },
): JSX.Element | null {
  const { params, onChange, availableColumns } = props;

  switch (blockType) {
    case "drop_nulls":
      return (
        <DropNullsConfig
          params={params}
          onChange={onChange}
          availableColumns={availableColumns}
        />
      );
    case "fill_missing_mean":
    case "fill_missing_median":
      return (
        <FillMissingConfig
          params={params}
          onChange={onChange}
          availableColumns={availableColumns}
          isMean={blockType === "fill_missing_mean"}
        />
      );
    case "encode_categoricals_onehot":
    case "encode_categoricals_ordinal":
      return (
        <EncodeCategoricalsConfig
          params={params}
          onChange={onChange}
          availableColumns={availableColumns}
          isOneHot={blockType === "encode_categoricals_onehot"}
        />
      );
    case "scale_numerics_standard":
    case "scale_numerics_minmax":
      return (
        <ScaleNumericsConfig
          params={params}
          onChange={onChange}
          availableColumns={availableColumns}
          isStandard={blockType === "scale_numerics_standard"}
        />
      );
    case "log_transform":
      return (
        <LogTransformConfig
          params={params}
          onChange={onChange}
          availableColumns={availableColumns}
        />
      );
    case "remove_outliers":
      return (
        <RemoveOutliersConfig
          params={params}
          onChange={onChange}
          availableColumns={availableColumns}
        />
      );
    case "feature_selection":
      return (
        <FeatureSelectionConfig
          params={params}
          onChange={onChange}
          availableColumns={availableColumns}
        />
      );
    case "split":
      return (
        <TrainValTestSplitConfig
          params={params}
          onChange={onChange}
          availableColumns={availableColumns}
        />
      );
    default:
      return null;
  }
}

/**
 * Convert pipeline blocks to API format.
 */
function blocksToApiFormat(
  blocks: PipelineBlockData[],
): Array<{ type: string; params: Record<string, unknown> }> {
  return blocks.map((block) => ({
    type: block.type,
    params: block.params,
  }));
}

/**
 * Props for the SortableBlockWrapper component.
 */
interface SortableBlockWrapperProps {
  block: PipelineBlockData;
  index: number;
  isSelected: boolean;
  onSelect: (blockId: string) => void;
  onConfigure: (blockId: string) => void;
  onRemove: (blockId: string) => void;
  onParamsChange: (blockId: string, params: Record<string, unknown>) => void;
  availableColumns: ColumnOption[];
}

/**
 * Wrapper component that combines PipelineBlock with sortable functionality.
 * Uses @dnd-kit's useSortable hook to provide drag-and-drop capabilities.
 */
function SortableBlockWrapper({
  block,
  index,
  isSelected,
  onSelect,
  onConfigure,
  onRemove,
  onParamsChange,
  availableColumns,
}: SortableBlockWrapperProps): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleParamsChange = useCallback(
    (params: Record<string, unknown>) => {
      onParamsChange(block.id, params);
    },
    [block.id, onParamsChange],
  );

  const configComponent = isSelected
    ? getBlockConfigComponent(block.type, {
        params: block.params,
        onChange: handleParamsChange,
        availableColumns,
      })
    : null;

  return (
    <div ref={setNodeRef} style={style} {...attributes} role="listitem">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <PipelineBlock
          id={block.id}
          blockType={block.type}
          label={block.name}
          description={block.description}
          params={block.params}
          status={block.status}
          isSelected={isSelected}
          sequenceNumber={index + 1}
          errorMessage={block.errorMessage}
          warningMessage={block.warningMessage}
          onConfigure={onConfigure}
          onRemove={onRemove}
          onSelect={onSelect}
          dragHandleProps={listeners}
          isDragging={isDragging}
        />
        {configComponent && (
          <div style={styles.configPanel}>{configComponent}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Pipeline builder wizard step component.
 *
 * Renders the step description, a vertical list of configured pipeline blocks,
 * and a block palette sidebar for adding new blocks. Supports drag-and-drop
 * reordering of blocks and inline configuration panels.
 *
 * Features:
 * - Block validation with error/warning display (Task 158)
 * - Pipeline save with API integration (Task 159)
 * - Pipeline reuse with saved pipelines dropdown (Task 160)
 * - Per-block status indicators (Task 161)
 *
 * @param props - Component props
 * @returns The pipeline builder screen
 */
export function PipelineBuilder({
  projectId,
  onComplete,
}: PipelineBuilderProps): JSX.Element {
  const { showSuccessToast, showErrorToast } = useAppStore();

  /** Currently configured pipeline blocks */
  const [blocks, setBlocks] = useState<PipelineBlockData[]>([]);
  /** Currently selected block for editing */
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  /** Whether the block palette is visible (for mobile) */
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  /** Loading state for validation */
  const [isValidating, setIsValidating] = useState(false);
  /** Loading state for save */
  const [isSaving, setIsSaving] = useState(false);
  /** Whether pipeline has been saved */
  const [isSaved, setIsSaved] = useState(false);
  /** Saved pipelines for reuse */
  const [savedPipelines, setSavedPipelines] = useState<PipelineResponse[]>([]);
  /** Currently selected saved pipeline ID */
  const [selectedSavedPipelineId, setSelectedSavedPipelineId] =
    useState<string>("");
  /** Loading state for fetching saved pipelines */
  const [isLoadingPipelines, setIsLoadingPipelines] = useState(false);
  /** Last saved or loaded pipeline ID */
  const [lastSavedPipelineId, setLastSavedPipelineId] = useState<string | null>(null);

  // Fallback columns used when snapshot columns are unavailable or loading
  const fallbackColumns: ColumnOption[] = useMemo(() => [
    { value: "age", label: "Age", type: "numeric" },
    { value: "income", label: "Income", type: "numeric" },
    { value: "gender", label: "Gender", type: "categorical" },
    { value: "city", label: "City", type: "categorical" },
    { value: "score", label: "Score", type: "numeric" },
  ], []);

  /** Available columns from the dataset snapshot schema */
  const [availableColumns, setAvailableColumns] = useState<ColumnOption[]>(fallbackColumns);

  /** Currently active dataset snapshot ID */
  const [currentSnapshotId, setCurrentSnapshotId] = useState<string>("snapshot-1");
  /** Loading state for fetching snapshot details */
  const [, setIsLoadingSnapshot] = useState(false);

  /** Fetch active snapshot and its columns on mount/projectId change */
  useEffect(() => {
    let isMounted = true;
    async function loadSnapshotDetails() {
      setIsLoadingSnapshot(true);
      try {
        const snapshots = await fetchProjectSnapshots(projectId);
        if (!isMounted) return;
        if (snapshots && snapshots.length > 0) {
          // Results are ordered by creation time oldest first, so last is the latest
          const latestSnapshot = snapshots[snapshots.length - 1];
          setCurrentSnapshotId(latestSnapshot.id);

          const details = await fetchSnapshotDetails(projectId, latestSnapshot.id);
          if (!isMounted) return;
          if (details && details.schema) {
            const cols = details.schema.map((col) => ({
              value: col.name,
              label: col.name.charAt(0).toUpperCase() + col.name.slice(1),
              type: col.inferred_type === "numeric" || col.inferred_type === "integer" || col.inferred_type === "float" ? "numeric" : "categorical",
            }));
            setAvailableColumns(cols);
          }
        }
      } catch (err) {
        console.error("Failed to load snapshot details:", err);
      } finally {
        if (isMounted) {
          setIsLoadingSnapshot(false);
        }
      }
    }

    void loadSnapshotDetails();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  /** Configure DndKit sensors */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /** Block IDs for SortableContext */
  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks]);

  /**
   * Fetch saved pipelines on mount (Task 160).
   */
  useEffect(() => {
    async function loadSavedPipelines() {
      setIsLoadingPipelines(true);
      try {
        const pipelines = await fetchProjectPipelines(projectId);
        setSavedPipelines(pipelines);
      } catch (err) {
        console.error("Failed to load saved pipelines:", err);
      } finally {
        setIsLoadingPipelines(false);
      }
    }

    void loadSavedPipelines();
  }, [projectId]);

  /**
   * Handle drag end event to reorder blocks.
   */
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      // Reset saved state when blocks are reordered
      setIsSaved(false);
    }
  }, []);

  /**
   * Add a new block to the pipeline.
   */
  const handleAddBlock = useCallback((paletteItem: BlockPaletteItem) => {
    const newBlock: PipelineBlockData = {
      id: generateBlockId(paletteItem.type),
      type: paletteItem.type,
      name: paletteItem.name,
      description: paletteItem.description,
      status: "configured",
      params: {},
    };

    setBlocks((prevBlocks) => [...prevBlocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    // Reset saved state when new block is added
    setIsSaved(false);
  }, []);

  /**
   * Remove a block from the pipeline.
   */
  const handleRemoveBlock = useCallback(
    (blockId: string) => {
      setBlocks((prevBlocks) => prevBlocks.filter((b) => b.id !== blockId));
      if (selectedBlockId === blockId) {
        setSelectedBlockId(null);
      }
      // Reset saved state when block is removed
      setIsSaved(false);
    },
    [selectedBlockId],
  );

  /**
   * Select a block for editing.
   */
  const handleSelectBlock = useCallback((blockId: string) => {
    setSelectedBlockId((current) => (current === blockId ? null : blockId));
  }, []);

  /**
   * Configure a block (opens inline config panel).
   */
  const handleConfigureBlock = useCallback((blockId: string) => {
    setSelectedBlockId(blockId);
  }, []);

  /**
   * Update block parameters.
   */
  const handleParamsChange = useCallback(
    (blockId: string, params: Record<string, unknown>) => {
      setBlocks((prevBlocks) =>
        prevBlocks.map((b) =>
          b.id === blockId
            ? { ...b, params, status: "configured" as BlockStatus }
            : b,
        ),
      );
      // Reset saved state when params change
      setIsSaved(false);
    },
    [],
  );

  /**
   * Validate pipeline configuration (Task 158).
   * Calls API to validate and displays errors/warnings.
   */
  const handleValidate = useCallback(async () => {
    if (blocks.length === 0) {
      showErrorToast("Pipeline must have at least one block");
      return;
    }

    setIsValidating(true);
    try {
      const result = await validatePipelineConfig(projectId, {
        snapshot_id: currentSnapshotId,
        blocks: blocksToApiFormat(blocks),
      });

      // Update block statuses based on validation result
      setBlocks((prevBlocks) =>
        prevBlocks.map((block, index) => {
          const blockErrors = result.errors.filter(
            (e) => e.block_index === index,
          );
          const blockWarnings = result.warnings.filter(
            (w) => w.block_index === index,
          );

          let status: BlockStatus = "validated";
          if (blockErrors.length > 0) {
            status = "error";
          } else if (blockWarnings.length > 0) {
            status = "warning";
          }

          return {
            ...block,
            status,
            errorMessage:
              blockErrors.map((e) => e.message).join("; ") || undefined,
            warningMessage:
              blockWarnings.map((w) => w.message).join("; ") || undefined,
          };
        }),
      );

      if (result.valid) {
        showSuccessToast("Pipeline validation successful");
      } else {
        const errorCount = result.errors.length;
        const warningCount = result.warnings.length;
        showErrorToast(
          `Validation failed: ${errorCount} error(s), ${warningCount} warning(s)`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed";
      showErrorToast(message);
    } finally {
      setIsValidating(false);
    }
  }, [blocks, projectId, currentSnapshotId, showErrorToast, showSuccessToast]);

  /**
   * Save pipeline configuration (Task 159).
   * Calls API to save and shows success toast.
   */
  const handleSave = useCallback(async () => {
    if (blocks.length === 0) {
      showErrorToast("Pipeline must have at least one block");
      return;
    }

    // First validate
    setIsSaving(true);
    try {
      // Validate before saving
      const validationResult = await validatePipelineConfig(projectId, {
        snapshot_id: currentSnapshotId,
        blocks: blocksToApiFormat(blocks),
      });

      if (!validationResult.valid) {
        // Update block statuses to show errors
        setBlocks((prevBlocks) =>
          prevBlocks.map((block, index) => {
            const blockErrors = validationResult.errors.filter(
              (e) => e.block_index === index,
            );
            const blockWarnings = validationResult.warnings.filter(
              (w) => w.block_index === index,
            );

            let status: BlockStatus = block.status;
            if (blockErrors.length > 0) {
              status = "error";
            } else if (blockWarnings.length > 0) {
              status = "warning";
            }

            return {
              ...block,
              status,
              errorMessage:
                blockErrors.map((e) => e.message).join("; ") || undefined,
              warningMessage:
                blockWarnings.map((w) => w.message).join("; ") || undefined,
            };
          }),
        );

        showErrorToast("Please fix validation errors before saving");
        return;
      }

      // Save the pipeline
      const savedPipeline = await createPipeline(projectId, {
        snapshot_id: currentSnapshotId,
        blocks: blocksToApiFormat(blocks),
      });

      setLastSavedPipelineId(savedPipeline.id);
      setIsSaved(true);
      showSuccessToast("Pipeline saved successfully");

      // Refresh saved pipelines list
      const pipelines = await fetchProjectPipelines(projectId);
      setSavedPipelines(pipelines);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save pipeline";
      showErrorToast(message);
    } finally {
      setIsSaving(false);
    }
  }, [blocks, projectId, currentSnapshotId, showErrorToast, showSuccessToast]);

  /**
   * Load a saved pipeline (Task 160).
   * Populates the block list from saved config_json.
   */
  const handleLoadSavedPipeline = useCallback(
    async (pipelineId: string) => {
      if (!pipelineId) return;

      const pipeline = savedPipelines.find((p) => p.id === pipelineId);
      if (!pipeline) return;

      // Convert saved blocks to PipelineBlockData
      const savedBlocks = pipeline.config_json.blocks.map((block, index) => ({
        id: generateBlockId(block.type as BlockType),
        type: block.type as BlockType,
        name:
          BLOCK_PALETTE.find((b) => b.type === block.type)?.name ?? block.type,
        description:
          BLOCK_PALETTE.find((b) => b.type === block.type)?.description ?? "",
        status: "configured" as BlockStatus,
        params: block.params,
      }));

      setBlocks(savedBlocks);
      setSelectedBlockId(null);
      setIsSaved(true);
      setLastSavedPipelineId(pipelineId);
      showSuccessToast("Pipeline loaded successfully");
    },
    [savedPipelines, showSuccessToast],
  );

  /**
   * Handle saved pipeline selection change.
   */
  const handleSavedPipelineChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    const pipelineId = e.target.value;
    setSelectedSavedPipelineId(pipelineId);
    if (pipelineId) {
      void handleLoadSavedPipeline(pipelineId);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Pipeline Builder</h1>
        <p style={styles.description}>
          Arrange preprocessing steps to clean, encode, and split your data.
        </p>
      </header>

      <div style={styles.content}>
        {/* Block Palette - Sidebar/Drawer */}
        <aside
          style={{
            ...styles.palette,
            ...(isPaletteOpen ? styles.paletteOpen : styles.paletteClosed),
          }}
          aria-label="Block palette"
        >
          <div style={styles.paletteHeader}>
            <h2 style={styles.paletteTitle}>Block Palette</h2>
            <p style={styles.paletteSubtitle}>
              Click to add blocks to your pipeline
            </p>
          </div>

          <div style={styles.paletteContent}>
            {BLOCK_PALETTE.map((block) => (
              <button
                key={block.type}
                style={styles.paletteItem}
                onClick={() => handleAddBlock(block)}
                type="button"
                aria-label={`Add ${block.name} block`}
                title={block.description}
              >
                <span style={styles.paletteItemIcon} aria-hidden="true">
                  {block.icon}
                </span>
                <div style={styles.paletteItemInfo}>
                  <span style={styles.paletteItemName}>{block.name}</span>
                  <span style={styles.paletteItemDescription}>
                    {block.description}
                  </span>
                </div>
                <span style={styles.paletteItemAdd} aria-hidden="true">
                  +
                </span>
              </button>
            ))}
          </div>

          {/* Saved Pipelines Section (Task 160) */}
          <div style={styles.savedPipelinesSection}>
            <h3 style={styles.savedPipelinesTitle}>Load Saved Pipeline</h3>
            <select
              value={selectedSavedPipelineId}
              onChange={handleSavedPipelineChange}
              style={styles.savedPipelinesSelect}
              disabled={isLoadingPipelines}
            >
              <option value="">Select a saved pipeline...</option>
              {savedPipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.id.slice(0, 8)}... (
                  {pipeline.config_json.blocks.length} blocks)
                </option>
              ))}
            </select>
            {isLoadingPipelines && (
              <span style={styles.loadingText}>Loading...</span>
            )}
          </div>
        </aside>

        {/* Main Pipeline Area */}
        <main style={styles.pipelineArea} aria-label="Pipeline configuration">
          {/* Mobile palette toggle */}
          <button
            style={styles.paletteToggle}
            onClick={() => setIsPaletteOpen(!isPaletteOpen)}
            type="button"
            aria-expanded={isPaletteOpen}
            aria-controls="block-palette"
          >
            {isPaletteOpen ? "Hide Palette" : "Show Block Palette"}
          </button>

          {/* Pipeline blocks list with drag-and-drop */}
          <div style={styles.blocksContainer}>
            {blocks.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyStateIcon} aria-hidden="true">
                  🧱
                </div>
                <h3 style={styles.emptyStateTitle}>No blocks added yet</h3>
                <p style={styles.emptyStateText}>
                  Select blocks from the palette on the left to build your
                  preprocessing pipeline. Start with data cleaning, then
                  encoding, scaling, and finish with a train/val/test split.
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={blockIds as UniqueIdentifier[]}
                  strategy={verticalListSortingStrategy}
                >
                  <div
                    style={styles.blocksList}
                    role="list"
                    aria-label="Pipeline blocks"
                  >
                    {blocks.map((block, index) => (
                      <SortableBlockWrapper
                        key={block.id}
                        block={block}
                        index={index}
                        isSelected={selectedBlockId === block.id}
                        onSelect={handleSelectBlock}
                        onConfigure={handleConfigureBlock}
                        onRemove={handleRemoveBlock}
                        onParamsChange={handleParamsChange}
                        availableColumns={availableColumns}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Pipeline actions */}
          {blocks.length > 0 && (
            <div style={styles.pipelineActions}>
              <button
                style={styles.secondaryButton}
                onClick={() => {
                  setBlocks([]);
                  setIsSaved(false);
                }}
                type="button"
                disabled={isSaving}
              >
                Clear All
              </button>
              <button
                style={styles.secondaryButton}
                onClick={handleValidate}
                type="button"
                disabled={isValidating || blocks.length === 0}
              >
                {isValidating ? "Validating..." : "Validate Pipeline"}
              </button>
              <button
                style={{
                  ...styles.primaryButton,
                  ...(isSaved ? styles.primaryButtonSaved : {}),
                }}
                onClick={handleSave}
                type="button"
                disabled={isSaving || blocks.length === 0}
              >
                {isSaving ? "Saving..." : isSaved ? "Saved ✓" : "Save Pipeline"}
              </button>
              {isSaved && onComplete && (
                <button
                  style={styles.nextButton}
                  onClick={() => {
                    if (lastSavedPipelineId) {
                      usePipelineStore.getState().setSavedPipelineId(lastSavedPipelineId);
                    }
                    onComplete();
                  }}
                  type="button"
                >
                  Next →
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "2rem",
  },
  header: {
    marginBottom: "2rem",
  },
  title: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#111827",
  },
  description: {
    margin: 0,
    color: "#6b7280",
    fontSize: "0.875rem",
  },
  content: {
    display: "flex",
    gap: "1.5rem",
    minHeight: "500px",
  },
  palette: {
    width: "300px",
    flexShrink: 0,
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  paletteOpen: {
    display: "flex",
  },
  paletteClosed: {
    display: "none",
  },
  paletteHeader: {
    padding: "1rem 1rem 0.75rem",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
  },
  paletteTitle: {
    margin: "0 0 0.25rem 0",
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  paletteSubtitle: {
    margin: 0,
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  paletteContent: {
    flex: 1,
    overflowY: "auto",
    padding: "0.75rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  paletteItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.75rem",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.15s ease",
    textAlign: "left",
    width: "100%",
  },
  paletteItemIcon: {
    fontSize: "1.25rem",
    flexShrink: 0,
  },
  paletteItemInfo: {
    flex: 1,
    minWidth: 0,
  },
  paletteItemName: {
    display: "block",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
    marginBottom: "0.125rem",
  },
  paletteItemDescription: {
    display: "block",
    fontSize: "0.75rem",
    color: "#6b7280",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  paletteItemAdd: {
    fontSize: "1.25rem",
    fontWeight: 500,
    color: "#2563eb",
    flexShrink: 0,
  },
  savedPipelinesSection: {
    padding: "1rem",
    borderTop: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
  },
  savedPipelinesTitle: {
    margin: "0 0 0.5rem 0",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  savedPipelinesSelect: {
    width: "100%",
    padding: "0.5rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    backgroundColor: "#ffffff",
    cursor: "pointer",
  },
  loadingText: {
    fontSize: "0.75rem",
    color: "#6b7280",
    marginTop: "0.25rem",
  },
  pipelineArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  paletteToggle: {
    display: "none",
    marginBottom: "1rem",
    padding: "0.5rem 1rem",
    backgroundColor: "#f3f4f6",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "0.875rem",
    color: "#374151",
    cursor: "pointer",
  },
  blocksContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.5rem",
    overflowY: "auto",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    minHeight: "300px",
    textAlign: "center",
  },
  emptyStateIcon: {
    fontSize: "3rem",
    marginBottom: "1rem",
  },
  emptyStateTitle: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.125rem",
    fontWeight: 600,
    color: "#374151",
  },
  emptyStateText: {
    margin: 0,
    maxWidth: "400px",
    fontSize: "0.875rem",
    color: "#6b7280",
    lineHeight: 1.5,
  },
  blocksList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  configPanel: {
    marginLeft: "2rem",
    marginRight: "2rem",
  },
  pipelineActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    marginTop: "1.5rem",
    paddingTop: "1rem",
    borderTop: "1px solid #e5e7eb",
  },
  primaryButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  primaryButtonSaved: {
    backgroundColor: "#22c55e",
  },
  secondaryButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#ffffff",
    color: "#374151",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  nextButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#7c3aed",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
};
