/**
 * Pipeline state store using Zustand.
 *
 * Manages the visual pipeline blocks, validation results, and saved pipeline ID.
 * Provides actions to add, remove, reorder, and configure pipeline blocks.
 *
 * @module stores/pipelineStore
 */
import { create } from "zustand";
import { type BlockType, type BlockStatus } from "../components/PipelineBlock";
import { type PipelineValidationResult } from "../utils/api";

/**
 * Pipeline block representation in the store.
 */
export interface PipelineBlock {
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
 * Validation result type alias for the pipeline validation response.
 */
export type ValidationResult = PipelineValidationResult;

/**
 * Pipeline store state interface.
 */
interface PipelineState {
  /** Ordered array of blocks in the current pipeline */
  blocks: PipelineBlock[];
  /** Latest validation result from the backend, null if not validated */
  validationResult: ValidationResult | null;
  /** Saved pipeline ID returned from the backend after save, null if unsaved */
  savedPipelineId: string | null;
}

/**
 * Pipeline store actions interface.
 */
interface PipelineActions {
  /**
   * Add a new block to the end of the pipeline.
   *
   * @param block - The pipeline block to add
   */
  addBlock: (block: PipelineBlock) => void;

  /**
   * Remove a block from the pipeline by ID.
   *
   * @param blockId - The ID of the block to remove
   */
  removeBlock: (blockId: string) => void;

  /**
   * Reorder the blocks in the pipeline.
   * Accepts a new ordered array of blocks.
   *
   * @param blocks - The new ordered array of blocks
   */
  reorderBlocks: (blocks: PipelineBlock[]) => void;

  /**
   * Update the configuration parameters of a specific block.
   * Automatically resets status to 'configured' as parameters have changed.
   *
   * @param blockId - The ID of the block to update
   * @param params - The new parameters to merge/set
   */
  updateBlockParams: (blockId: string, params: Record<string, unknown>) => void;

  /**
   * Set the latest validation result from the backend.
   *
   * @param result - The validation result or null to clear
   */
  setValidationResult: (result: ValidationResult | null) => void;

  /**
   * Set the saved pipeline ID from the backend.
   *
   * @param id - The saved pipeline ID or null to clear
   */
  setSavedPipelineId: (id: string | null) => void;

  /**
   * Set all blocks in the pipeline. Useful when loading a saved pipeline.
   *
   * @param blocks - Array of blocks to set
   */
  setBlocks: (blocks: PipelineBlock[]) => void;

  /**
   * Clear the pipeline store state.
   */
  clearPipelineStore: () => void;
}

/**
 * Combined pipeline store type.
 */
export type PipelineStore = PipelineState & PipelineActions;

/**
 * Initial pipeline state.
 */
const initialState: PipelineState = {
  blocks: [],
  validationResult: null,
  savedPipelineId: null,
};

/**
 * Pipeline store using Zustand.
 *
 * @example
 * const { blocks, addBlock, removeBlock, reorderBlocks } = usePipelineStore();
 */
export const usePipelineStore = create<PipelineStore>((set: any) => ({
  ...initialState,

  addBlock: (block: PipelineBlock): void => {
    set((state: PipelineStore) => ({
      blocks: [...state.blocks, block],
      // Reset saved ID and validation result since pipeline has changed
      savedPipelineId: null,
      validationResult: null,
    }));
  },

  removeBlock: (blockId: string): void => {
    set((state: PipelineStore) => ({
      blocks: state.blocks.filter((b: PipelineBlock) => b.id !== blockId),
      // Reset saved ID and validation result since pipeline has changed
      savedPipelineId: null,
      validationResult: null,
    }));
  },

  reorderBlocks: (blocks: PipelineBlock[]): void => {
    set(() => ({
      blocks,
      // Reset saved ID and validation result since pipeline has changed
      savedPipelineId: null,
      validationResult: null,
    }));
  },

  updateBlockParams: (blockId: string, params: Record<string, unknown>): void => {
    set((state: PipelineStore) => ({
      blocks: state.blocks.map((b: PipelineBlock) =>
        b.id === blockId ? { ...b, params, status: "configured" as BlockStatus } : b
      ),
      // Reset saved ID and validation result since parameters have changed
      savedPipelineId: null,
      validationResult: null,
    }));
  },

  setValidationResult: (result: ValidationResult | null): void => {
    set(() => ({
      validationResult: result,
    }));
  },

  setSavedPipelineId: (id: string | null): void => {
    set(() => ({
      savedPipelineId: id,
    }));
  },

  setBlocks: (blocks: PipelineBlock[]): void => {
    set(() => ({
      blocks,
    }));
  },

  clearPipelineStore: (): void => {
    set(() => initialState);
  },
}));

/**
 * Hook selector for accessing individual pipeline state values.
 * Use this when you only need a specific value to minimize re-renders.
 */
export const usePipelineSelector = usePipelineStore;

/**
 * Get the current blocks from the store.
 * Useful for non-component contexts.
 *
 * @returns The current blocks array
 */
export function getPipelineBlocks(): PipelineBlock[] {
  return usePipelineStore.getState().blocks;
}

/**
 * Get the current validation result from the store.
 *
 * @returns The validation result or null
 */
export function getValidationResult(): ValidationResult | null {
  return usePipelineStore.getState().validationResult;
}

/**
 * Get the current saved pipeline ID from the store.
 *
 * @returns The saved pipeline ID or null
 */
export function getSavedPipelineId(): string | null {
  return usePipelineStore.getState().savedPipelineId;
}
