/**
 * Window state persistence module for the Electron main process.
 *
 * Saves and restores the main window size and position to/from a JSON file
 * stored in the OpenNeural data directory (~/openneural/window-state.json).
 * This allows the application to remember its last position and dimensions
 * across restarts.
 *
 * The state file is stored as JSON with the following structure:
 * - width: number (window width in pixels)
 * - height: number (window height in pixels)
 * - x: number | undefined (window x position, undefined if centered)
 * - y: number | undefined (window y position, undefined if centered)
 * - isMaximized: boolean (whether window was maximized)
 * - isFullScreen: boolean (whether window was in fullscreen mode)
 *
 * Security considerations:
 * - File is stored in the user's data directory with restrictive permissions
 * - JSON parsing uses a reviver to validate numeric values
 * - Position is validated against current display bounds to ensure visibility
 *
 * @module window-state
 */
import fs from "node:fs";
import path from "node:path";
import { screen } from "electron";
import { getDataDir } from "./auth";

/**
 * Interface representing the persisted window state.
 */
export interface WindowState {
  /** Window width in pixels */
  width: number;
  /** Window height in pixels */
  height: number;
  /** Window x position (undefined if centered or not set) */
  x?: number;
  /** Window y position (undefined if centered or not set) */
  y?: number;
  /** Whether the window was maximized */
  isMaximized: boolean;
  /** Whether the window was in fullscreen mode */
  isFullScreen: boolean;
}

/**
 * Default window dimensions and state.
 */
const DEFAULT_STATE: WindowState = {
  width: 1200,
  height: 800,
  isMaximized: false,
  isFullScreen: false
};

/**
 * Minimum allowed window dimensions.
 */
const MIN_WIDTH = 960;
const MIN_HEIGHT = 640;

/**
 * Gets the path to the window state JSON file.
 *
 * @returns Absolute path to window-state.json in the data directory
 */
function getStateFilePath(): string {
  return path.join(getDataDir(), "window-state.json");
}

/**
 * Validates that a value is a valid finite number within optional bounds.
 *
 * @param value - The value to validate
 * @param min - Optional minimum value
 * @param max - Optional maximum value
 * @returns The value if valid, undefined otherwise
 */
function validateNumber(
  value: unknown,
  min?: number,
  max?: number
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  if (min !== undefined && value < min) {
    return undefined;
  }

  if (max !== undefined && value > max) {
    return undefined;
  }

  return value;
}

/**
 * Validates the parsed window state object.
 *
 * Ensures all required fields are present and have valid types/ranges.
 * Invalid or missing fields fall back to defaults.
 *
 * @param data - The parsed JSON data
 * @returns Validated WindowState object
 */
function validateWindowState(data: unknown): WindowState {
  if (typeof data !== "object" || data === null) {
    return { ...DEFAULT_STATE };
  }

  const obj = data as Record<string, unknown>;

  // Validate dimensions with minimum constraints
  const width = validateNumber(obj.width, MIN_WIDTH) ?? DEFAULT_STATE.width;
  const height = validateNumber(obj.height, MIN_HEIGHT) ?? DEFAULT_STATE.height;

  // Validate position (optional, can be undefined)
  const x = validateNumber(obj.x);
  const y = validateNumber(obj.y);

  // Validate boolean flags
  const isMaximized = obj.isMaximized === true;
  const isFullScreen = obj.isFullScreen === true;

  return {
    width,
    height,
    ...(x !== undefined && { x }),
    ...(y !== undefined && { y }),
    isMaximized,
    isFullScreen
  };
}

/**
 * Loads the saved window state from the JSON file.
 *
 * If the file doesn't exist or is malformed, returns default state.
 * Validates position against current display bounds to ensure the window
 * will be visible on screen.
 *
 * @returns WindowState with validated size and position
 */
export function loadWindowState(): WindowState {
  const stateFilePath = getStateFilePath();

  // Return defaults if file doesn't exist
  if (!fs.existsSync(stateFilePath)) {
    return { ...DEFAULT_STATE };
  }

  try {
    const data = fs.readFileSync(stateFilePath, "utf-8");
    const parsed = JSON.parse(data) as unknown;
    const state = validateWindowState(parsed);

    // Validate position is on a visible display
    if (state.x !== undefined && state.y !== undefined) {
      const displayBounds = screen.getDisplayNearestPoint({
        x: state.x,
        y: state.y
      }).bounds;

      // Check if window is at least partially visible on screen
      const isVisible =
        state.x < displayBounds.x + displayBounds.width &&
        state.x + state.width > displayBounds.x &&
        state.y < displayBounds.y + displayBounds.height &&
        state.y + state.height > displayBounds.y;

      if (!isVisible) {
        // Position is off-screen, remove position to use default centering
        delete state.x;
        delete state.y;
      }
    }

    return state;
  } catch (error) {
    // Log error but return defaults on any read/parse failure
    console.error("Failed to load window state:", error);
    return { ...DEFAULT_STATE };
  }
}

/**
 * Saves the current window state to the JSON file.
 *
 * Writes the state atomically to prevent corruption during writes.
 * Creates the data directory if it doesn't exist.
 *
 * @param state - The window state to save
 */
export function saveWindowState(state: WindowState): void {
  const stateFilePath = getStateFilePath();
  const dataDir = getDataDir();

  try {
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    }

    // Validate state before saving
    const validatedState = validateWindowState(state);

    // Write atomically: write to temp file, then rename
    const tempPath = `${stateFilePath}.tmp`;
    const json = JSON.stringify(validatedState, null, 2);

    fs.writeFileSync(tempPath, json, { encoding: "utf-8", mode: 0o600 });
    fs.renameSync(tempPath, stateFilePath);
  } catch (error) {
    console.error("Failed to save window state:", error);
  }
}

/**
 * Resets the window state to defaults.
 *
 * Deletes the state file if it exists. The next window creation
 * will use default dimensions and centered positioning.
 */
export function resetWindowState(): void {
  const stateFilePath = getStateFilePath();

  try {
    if (fs.existsSync(stateFilePath)) {
      fs.unlinkSync(stateFilePath);
    }
  } catch (error) {
    console.error("Failed to reset window state:", error);
  }
}
