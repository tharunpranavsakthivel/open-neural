/**
 * PipelineBuilder screen - Step 2: Visual preprocessing pipeline builder.
 *
 * Allows users to build a preprocessing pipeline by arranging visual blocks.
 * Displays a step description, a vertical list of pipeline blocks, and a
 * block palette for adding new blocks. Supports drag-and-drop reordering
 * of blocks using @dnd-kit.
 *
 * @module screens/PipelineBuilder
 */

import { useState, useCallback, useMemo } from "react";
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

interface PipelineBuilderProps {
  /** Currently selected project ID */
  projectId: string;
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
  { type: "drop_nulls", name: "Drop Nulls", description: "Remove rows with null values", icon: "🗑️" },
  { type: "fill_missing_mean", name: "Fill Missing (Mean)", description: "Impute missing values with column mean", icon: "📊" },
  { type: "fill_missing_median", name: "Fill Missing (Median)", description: "Impute missing values with column median", icon: "📈" },
  { type: "remove_outliers", name: "Remove Outliers", description: "Filter rows outside IQR range", icon: "✂️" },

  // Feature Encoding
  { type: "encode_categoricals_onehot", name: "One-Hot Encode", description: "One-hot encoding for categorical columns", icon: "🔥" },
  { type: "encode_categoricals_ordinal", name: "Ordinal Encode", description: "Ordinal encoding for categorical columns", icon: "🔢" },

  // Feature Scaling
  { type: "scale_numerics_standard", name: "Standard Scale", description: "Standardize numeric features (z-score)", icon: "⚖️" },
  { type: "scale_numerics_minmax", name: "Min-Max Scale", description: "Scale numeric features to [0,1] range", icon: "📏" },
  { type: "log_transform", name: "Log Transform", description: "Apply log transformation to numeric columns", icon: "📉" },

  // Feature Selection
  { type: "feature_selection", name: "Feature Selection", description: "Drop specified columns from the dataset", icon: "🎯" },

  // Data Split
  { type: "split", name: "Train/Val/Test Split", description: "Split data into train/validation/test sets", icon: "✂️" },
];

/**
 * Generates a unique ID for pipeline blocks.
 */
function generateBlockId(type: BlockType): string {
  return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      role="listitem"
    >
      <PipelineBlock
        id={block.id}
        blockType={block.type}
        label={block.name}
        description={block.description}
        params={block.params}
        status={block.status}
        isSelected={isSelected}
        sequenceNumber={index + 1}
        onConfigure={onConfigure}
        onRemove={onRemove}
        onSelect={onSelect}
        dragHandleProps={listeners}
        isDragging={isDragging}
      />
    </div>
  );
}

/**
 * Pipeline builder wizard step component.
 *
 * Renders the step description, a vertical list of configured pipeline blocks,
 * and a block palette sidebar for adding new blocks. Supports drag-and-drop
 * reordering of blocks.
 *
 * @param props - Component props
 * @returns The pipeline builder screen
 */
export function PipelineBuilder({
  projectId: _projectId,
}: PipelineBuilderProps): JSX.Element {
  /** Currently configured pipeline blocks */
  const [blocks, setBlocks] = useState<PipelineBlockData[]>([]);
  /** Currently selected block for editing */
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  /** Whether the block palette is visible (for mobile) */
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);

  /** Configure DndKit sensors */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px of movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /** Block IDs for SortableContext */
  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks]);

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
  }, []);

  /**
   * Remove a block from the pipeline.
   */
  const handleRemoveBlock = useCallback((blockId: string) => {
    setBlocks((prevBlocks) => prevBlocks.filter((b) => b.id !== blockId));
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  }, [selectedBlockId]);

  /**
   * Select a block for editing.
   */
  const handleSelectBlock = useCallback((blockId: string) => {
    setSelectedBlockId((current) => (current === blockId ? null : blockId));
  }, []);

  /**
   * Configure a block (placeholder for future implementation).
   */
  const handleConfigureBlock = useCallback((blockId: string) => {
    // TODO: Open configuration panel for the block
    console.log("Configure block:", blockId);
    setSelectedBlockId(blockId);
  }, []);

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
                <span style={styles.paletteItemAdd} aria-hidden="true">+</span>
              </button>
            ))}
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
                onClick={() => setBlocks([])}
                type="button"
              >
                Clear All
              </button>
              <button style={styles.primaryButton} type="button">
                Validate Pipeline
              </button>
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
  pipelineArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  paletteToggle: {
    display: "none", // Hidden on desktop, shown on mobile
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
};
