/**
 * Dataset snapshot state store using Zustand.
 *
 * Manages the current dataset snapshot and snapshot history for the active
 * project. Provides reactive state for dataset import and versioning.
 *
 * @module stores/datasetStore
 */
import { create } from "zustand";
import type { DatasetSnapshotResponse, SnapshotListItem } from "../utils/api";

/**
 * Snapshot type alias for the full snapshot response.
 * Represents a complete dataset snapshot with full metadata and schema.
 */
export type Snapshot = DatasetSnapshotResponse;

/**
 * Dataset store state interface.
 */
interface DatasetState {
  /** Currently selected/active snapshot, null if no dataset imported */
  currentSnapshot: Snapshot | null;
  /** History of all snapshots for the current project */
  snapshotHistory: SnapshotListItem[];
  /** File upload progress percentage (0-100) */
  uploadProgress: number;
}

/**
 * Dataset store actions interface.
 */
interface DatasetActions {
  /**
   * Set the current snapshot.
   * Called after successful dataset import or when selecting a snapshot from history.
   *
   * @param snapshot - The snapshot to set as current, or null to clear
   */
  setSnapshot: (snapshot: Snapshot | null) => void;

  /**
   * Set the snapshot history.
   * Called when loading snapshot history for a project.
   *
   * @param history - Array of snapshot list items
   */
  setSnapshotHistory: (history: SnapshotListItem[]) => void;

  /**
   * Set the current upload progress percentage.
   *
   * @param progress - Upload progress percentage (0-100)
   */
  setUploadProgress: (progress: number) => void;

  /**
   * Add a new snapshot to the history.
   * Called after importing a new dataset.
   *
   * @param snapshot - The snapshot to add to history
   */
  addSnapshotToHistory: (snapshot: SnapshotListItem) => void;

  /**
   * Clear the current snapshot and history.
   * Called when switching projects or resetting state.
   */
  clearDatasetState: () => void;

  /**
   * Update a specific snapshot in history.
   * Useful for updating metadata without reloading entire history.
   *
   * @param snapshotId - ID of the snapshot to update
   * @param updates - Partial updates to apply
   */
  updateSnapshotInHistory: (
    snapshotId: string,
    updates: Partial<SnapshotListItem>
  ) => void;

  /**
   * Remove a snapshot from history.
   *
   * @param snapshotId - ID of the snapshot to remove
   */
  removeSnapshotFromHistory: (snapshotId: string) => void;
}

/**
 * Combined dataset store type.
 */
type DatasetStore = DatasetState & DatasetActions;

/**
 * Initial dataset state.
 */
const initialState: DatasetState = {
  currentSnapshot: null,
  snapshotHistory: [],
  uploadProgress: 0,
};

/**
 * Dataset snapshot store using Zustand.
 *
 * Manages dataset snapshot state including the current active snapshot
 * and the history of all snapshots for the project.
 *
 * @example
 * const { currentSnapshot, snapshotHistory, setSnapshot } = useDatasetStore();
 *
 * // After importing a dataset
 * setSnapshot(response);
 *
 * // Load snapshot history
 * setSnapshotHistory(snapshots);
 */
export const useDatasetStore = create<DatasetStore>((set, get) => ({
  ...initialState,

  setSnapshot: (snapshot: Snapshot | null): void => {
    set(() => ({
      currentSnapshot: snapshot,
    }));
  },

  setSnapshotHistory: (history: SnapshotListItem[]): void => {
    set(() => ({
      snapshotHistory: history,
    }));
  },

  setUploadProgress: (progress: number): void => {
    set(() => ({
      uploadProgress: progress,
    }));
  },

  addSnapshotToHistory: (snapshot: SnapshotListItem): void => {
    set((state) => ({
      snapshotHistory: [snapshot, ...state.snapshotHistory],
    }));
  },

  clearDatasetState: (): void => {
    set(() => initialState);
  },

  updateSnapshotInHistory: (
    snapshotId: string,
    updates: Partial<SnapshotListItem>
  ): void => {
    set((state) => ({
      snapshotHistory: state.snapshotHistory.map((snapshot) =>
        snapshot.id === snapshotId ? { ...snapshot, ...updates } : snapshot
      ),
    }));
  },

  removeSnapshotFromHistory: (snapshotId: string): void => {
    set((state) => ({
      snapshotHistory: state.snapshotHistory.filter(
        (snapshot) => snapshot.id !== snapshotId
      ),
      // Also clear current snapshot if it matches the removed one
      currentSnapshot:
        state.currentSnapshot?.id === snapshotId
          ? null
          : state.currentSnapshot,
    }));
  },
}));

/**
 * Hook selector for accessing individual dataset state values.
 * Use this when you only need a specific value to minimize re-renders.
 *
 * @example
 * const currentSnapshot = useDatasetSelector((state) => state.currentSnapshot);
 * const setSnapshot = useDatasetSelector((state) => state.setSnapshot);
 */
export const useDatasetSelector = useDatasetStore;

/**
 * Get the current snapshot from the store.
 * Useful for non-component contexts.
 *
 * @returns The current snapshot or null if none selected
 */
export function getCurrentSnapshot(): Snapshot | null {
  return useDatasetStore.getState().currentSnapshot;
}

/**
 * Get the snapshot history from the store.
 *
 * @returns Array of snapshot list items
 */
export function getSnapshotHistory(): SnapshotListItem[] {
  return useDatasetStore.getState().snapshotHistory;
}

/**
 * Check if a snapshot is currently selected.
 *
 * @returns Whether a snapshot is selected
 */
export function hasCurrentSnapshot(): boolean {
  return useDatasetStore.getState().currentSnapshot !== null;
}

/**
 * Get the number of snapshots in history.
 *
 * @returns The snapshot count
 */
export function getSnapshotCount(): number {
  return useDatasetStore.getState().snapshotHistory.length;
}
