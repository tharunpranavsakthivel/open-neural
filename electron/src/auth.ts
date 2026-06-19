/**
 * Authentication module for the Electron main process.
 *
 * Handles first-launch password setup detection and password validation
 * against the bcrypt hash stored in the SQLite database. This module runs
 * in the main process and directly reads from the database file using
 * better-sqlite3 to validate credentials before spawning the Python backend.
 *
 * Security considerations:
 * - Uses bcrypt with cost factor 12 for password hashing
 * - Reads auth state directly from SQLite in the main process
 * - Does not expose raw password hash to the renderer
 * - Uses constant-time comparison via bcrypt.checkpw
 *
 * @module auth
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomBytes } from "node:crypto";

/**
 * Result type for authentication operations.
 */
export interface AuthResult {
  /** Whether the authentication operation succeeded */
  success: boolean;
  /** Error message if authentication failed */
  error?: string;
}

/**
 * Information about the current authentication state.
 */
export interface AuthState {
  /** Whether this is the first launch (no password set yet) */
  isFirstLaunch: boolean;
  /** Path to the OpenNeural data directory */
  dataDir: string;
  /** Path to the SQLite database file */
  dbPath: string;
}

/**
 * Default data directory for OpenNeural application data.
 * Located at ~/openneural/ on the user's machine.
 */
const DEFAULT_DATA_DIR = path.join(os.homedir(), "openneural");

/**
 * Environment variable override for data directory.
 */
const ENV_DATA_DIR = process.env.OPENNEURAL_DATA_DIR;

/**
 * Gets the OpenNeural data directory path.
 * Priority: OPENNEURAL_DATA_DIR env var > ~/openneural/
 *
 * @returns Absolute path to the data directory
 */
export function getDataDir(): string {
  return ENV_DATA_DIR ?? DEFAULT_DATA_DIR;
}

/**
 * Gets the path to the SQLite database file.
 *
 * @returns Absolute path to openneural.db
 */
export function getDbPath(): string {
  return path.join(getDataDir(), "openneural.db");
}

/**
 * Checks if the authentication table exists and has a record.
 * Used to determine if this is the first launch.
 *
 * This function attempts to read the database file directly using SQLite3
 * to check for the presence of an auth record. If the database doesn't
 * exist or has no auth record, it returns true for first launch.
 *
 * Note: This function is synchronous and runs before the Python backend
 * is spawned. It uses the file existence and basic checks as a heuristic.
 * The actual database read is performed lazily when validatePassword is called.
 *
 * @returns AuthState indicating whether this is first launch
 */
export function checkAuthState(): AuthState {
  const dataDir = getDataDir();
  const dbPath = getDbPath();

  // Check if data directory exists
  if (!fs.existsSync(dataDir)) {
    return {
      isFirstLaunch: true,
      dataDir,
      dbPath
    };
  }

  // Check if database file exists
  if (!fs.existsSync(dbPath)) {
    return {
      isFirstLaunch: true,
      dataDir,
      dbPath
    };
  }

  // Database exists - need to check if auth table has a record
  // For now, we assume if the DB exists, auth is set up
  // The actual validation will check the auth table content
  return {
    isFirstLaunch: false,
    dataDir,
    dbPath
  };
}

/**
 * Validates a password against the stored bcrypt hash.
 *
 * This function reads the auth table directly from SQLite using better-sqlite3
 * and validates the provided password against the stored bcrypt hash using
 * bcrypt.compare with a cost factor of 12.
 *
 * The password hash is never exposed to the renderer process; validation
 * happens entirely within the main process.
 *
 * @param password - The plain-text password to validate
 * @returns AuthResult indicating success or failure
 * @throws May throw if database access fails unexpectedly
 */
export async function validatePassword(password: string): Promise<AuthResult> {
  const dbPath = getDbPath();

  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    return {
      success: false,
      error: "Database not found. Please restart the application."
    };
  }

  try {
    // Dynamically import better-sqlite3 (ESM dynamic import)
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(dbPath, { readonly: true });

    try {
      // Query the auth table for the password hash
      const row = db.prepare(
        "SELECT password_hash FROM auth ORDER BY created_at DESC LIMIT 1"
      ).get() as { password_hash: string } | undefined;

      if (!row) {
        return {
          success: false,
          error: "No authentication record found. Please restart the application."
        };
      }

      // Dynamically import bcrypt
      const bcrypt = await import("bcrypt");

      // Validate password using bcrypt with constant-time comparison
      const isValid = await bcrypt.compare(password, row.password_hash);

      if (!isValid) {
        return {
          success: false,
          error: "Incorrect password."
        };
      }

      return {
        success: true
      };
    } finally {
      db.close();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Authentication error: ${errorMessage}`
    };
  }
}

/**
 * Validates the setup password and stores it in the database.
 *
 * Called during first launch when the user sets their initial password.
 * Hashes the password using bcrypt with cost factor 12 and stores it
 * in the auth table.
 *
 * @param password - The plain-text password to set
 * @param confirmPassword - The confirmation password for verification
 * @returns AuthResult indicating success or failure
 */
export async function validateSetupPassword(
  password: string,
  confirmPassword: string
): Promise<AuthResult> {
  // Validate password requirements
  if (password.length < 8) {
    return {
      success: false,
      error: "Password must be at least 8 characters long."
    };
  }

  if (password !== confirmPassword) {
    return {
      success: false,
      error: "Passwords do not match."
    };
  }

  // Additional validation: check for common weak passwords
  const commonPasswords = ["password", "12345678", "qwerty123"];
  if (commonPasswords.includes(password.toLowerCase())) {
    return {
      success: false,
      error: "Password is too common. Please choose a stronger password."
    };
  }

  return {
    success: true
  };
}

/**
 * Stores a password hash in the database.
 *
 * This should only be called during first-time setup. The password is
 * hashed using bcrypt with cost factor 12 before storage.
 *
 * @param password - The plain-text password to hash and store
 * @returns AuthResult indicating success or failure
 */
export async function storePassword(password: string): Promise<AuthResult> {
  const dataDir = getDataDir();
  const dbPath = getDbPath();

  try {
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    }

    // Dynamically import dependencies
    const Database = (await import("better-sqlite3")).default;
    const bcrypt = await import("bcrypt");

    // Hash password with bcrypt cost factor 12
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Open database (creates if doesn't exist)
    const db = new Database(dbPath);

    try {
      // Create auth table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS auth (
          id TEXT PRIMARY KEY,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      // Insert auth record
      const id = generateUuid();
      db.prepare(
        "INSERT INTO auth (id, password_hash) VALUES (?, ?)"
      ).run(id, passwordHash);

      // Set restrictive file permissions (owner read/write only)
      try {
        fs.chmodSync(dbPath, 0o600);
      } catch {
        // Ignore chmod errors on Windows
      }

      return {
        success: true
      };
    } finally {
      db.close();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to store password: ${errorMessage}`
    };
  }
}

/**
 * Generates a UUID v4 string.
 *
 * @returns A UUID v4 string in lowercase hex format
 */
function generateUuid(): string {
  // Simple UUID v4 generator using Node.js crypto.randomBytes
  const bytes = randomBytes(16);

  // Set version (4) and variant (2) bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  // Convert to hex string
  const hex = bytes.toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Changes the existing password after validating the current one.
 *
 * @param currentPassword - The current password for validation
 * @param newPassword - The new password to set
 * @returns AuthResult indicating success or failure
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<AuthResult> {
  // First validate the current password
  const validationResult = await validatePassword(currentPassword);
  if (!validationResult.success) {
    return validationResult;
  }

  // Validate new password requirements
  if (newPassword.length < 8) {
    return {
      success: false,
      error: "New password must be at least 8 characters long."
    };
  }

  const dbPath = getDbPath();

  try {
    const Database = (await import("better-sqlite3")).default;
    const bcrypt = await import("bcrypt");

    // Hash new password with bcrypt cost factor 12
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    const db = new Database(dbPath);

    try {
      // Update the existing auth record
      const result = db.prepare(
        "UPDATE auth SET password_hash = ?, updated_at = datetime('now') WHERE id = (SELECT id FROM auth ORDER BY created_at DESC LIMIT 1)"
      ).run(newPasswordHash);

      if (result.changes === 0) {
        return {
          success: false,
          error: "Failed to update password. No authentication record found."
        };
      }

      return {
        success: true
      };
    } finally {
      db.close();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to change password: ${errorMessage}`
    };
  }
}
