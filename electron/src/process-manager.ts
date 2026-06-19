/**
 * Python subprocess lifecycle manager for the Electron main process.
 *
 * Handles spawning the Python FastAPI backend, capturing the dynamic port
 * from stdout, and managing the process lifecycle (start, stop, graceful
 * shutdown). The Python backend is spawned with the ephemeral secret
 * and data directory environment variables.
 *
 * Process management features:
 * - Spawns Python backend with dynamic port assignment (port 0)
 * - Parses OPENNEURAL_PORT=<port> from stdout to discover the actual port
 * - Injects OPENNEURAL_SECRET environment variable for request validation
 * - Graceful shutdown with SIGTERM/SIGKILL fallback
 * - Process restart capability
 * - Error handling and logging
 *
 * @module process-manager
 */
import { spawn, ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

/**
 * Current Python subprocess instance.
 */
let pythonProcess: ChildProcess | null = null;

/**
 * Resolved backend port (null until discovered from stdout).
 */
let backendPort: number | null = null;

/**
 * Whether the backend is currently starting up.
 */
let isStarting = false;

/**
 * Event emitter for process state changes.
 */
const processEvents = new EventEmitter();

/**
 * Result of starting the Python backend.
 */
export interface BackendStartResult {
  /** Whether startup succeeded */
  success: boolean;
  /** The discovered port number (if successful) */
  port?: number;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Gets the current backend port.
 *
 * @returns The discovered port number, or null if not yet discovered
 */
export function getBackendPort(): number | null {
  return backendPort;
}

/**
 * Gets the current Python subprocess.
 *
 * @returns The ChildProcess instance, or null if not running
 */
export function getPythonProcess(): ChildProcess | null {
  return pythonProcess;
}

/**
 * Checks if the backend is currently running.
 *
 * @returns true if the process exists and hasn't exited
 */
export function isBackendRunning(): boolean {
  return pythonProcess !== null && !pythonProcess.killed;
}

/**
 * Checks if the backend is currently starting up.
 *
 * @returns true if startup is in progress
 */
export function isBackendStarting(): boolean {
  return isStarting;
}

/**
 * Parses the port from a stdout line.
 *
 * Expected format: OPENNEURAL_PORT=<port>
 *
 * @param line - A line of output from the Python process stdout
 * @returns The port number if found and valid, null otherwise
 */
function parsePortLine(line: string): number | null {
  const trimmed = line.trim();
  const prefix = "OPENNEURAL_PORT=";

  if (!trimmed.startsWith(prefix)) {
    return null;
  }

  const portStr = trimmed.slice(prefix.length);
  const port = parseInt(portStr, 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    return null;
  }

  return port;
}

/**
 * Starts the Python backend subprocess.
 *
 * Spawns the Python FastAPI backend with:
 * - Dynamic port assignment (--port 0)
 * - Data directory specified (--data-dir)
 * - Ephemeral secret injected (OPENNEURAL_SECRET env var)
 * - Inherits parent's environment
 *
 * Waits for the OPENNEURAL_PORT line on stdout to discover the actual
 * port assigned by the OS.
 *
 * @param dataDir - Path to the OpenNeural data directory
 * @param ephemeralSecret - The 64-character hex secret for request validation
 * @returns Promise resolving to BackendStartResult
 */
export async function startBackend(
  dataDir: string,
  ephemeralSecret: string
): Promise<BackendStartResult> {
  if (isStarting) {
    return {
      success: false,
      error: "Backend is already starting"
    };
  }

  if (isBackendRunning()) {
    return {
      success: false,
      error: "Backend is already running"
    };
  }

  isStarting = true;
  backendPort = null;
  processEvents.emit("starting");

  return new Promise((resolve) => {
    try {
      // Spawn Python backend with dynamic port (0 = OS assigns ephemeral port)
      pythonProcess = spawn("python", [
        "-m", "openneural_backend",
        "--port", "0",
        "--data-dir", dataDir
      ], {
        // Inherit stdio for debugging, but we'll capture stdout for port
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          OPENNEURAL_SECRET: ephemeralSecret
        }
      });

      let portResolved = false;
      let stdoutBuffer = "";

      // Handle stdout to capture the port announcement
      pythonProcess.stdout?.on("data", (data: Buffer) => {
        stdoutBuffer += data.toString("utf-8");

        // Process complete lines
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!portResolved) {
            const port = parsePortLine(line);
            if (port !== null) {
              portResolved = true;
              backendPort = port;
              isStarting = false;
              processEvents.emit("started", port);
              resolve({
                success: true,
                port
              });
            }
          }

          // Forward remaining stdout to console for debugging
          if (line.trim()) {
            console.log(`[Python] ${line}`);
          }
        }
      });

      // Handle stderr (forward to console)
      pythonProcess.stderr?.on("data", (data: Buffer) => {
        const lines = data.toString("utf-8").split("\n");
        for (const line of lines) {
          if (line.trim()) {
            console.error(`[Python] ${line}`);
          }
        }
      });

      // Handle process exit
      pythonProcess.on("exit", (code: number | null, signal: string | null) => {
        isStarting = false;
        backendPort = null;

        if (!portResolved) {
          // Process exited before we got the port
          resolve({
            success: false,
            error: `Python process exited before port announcement (code: ${code}, signal: ${signal})`
          });
        }

        processEvents.emit("exited", { code, signal });
        console.log(`Python process exited (code: ${code}, signal: ${signal})`);
      });

      // Handle process error (spawn failure)
      pythonProcess.on("error", (error: Error) => {
        isStarting = false;
        backendPort = null;

        if (!portResolved) {
          resolve({
            success: false,
            error: `Failed to spawn Python process: ${error.message}`
          });
        }

        processEvents.emit("error", error);
        console.error("Python process error:", error);
      });

      // Timeout if port not received within 30 seconds
      const timeout = setTimeout(() => {
        if (!portResolved) {
          // Kill the process if it's still running
          if (pythonProcess && !pythonProcess.killed) {
            pythonProcess.kill("SIGTERM");
          }

          resolve({
            success: false,
            error: "Timeout waiting for Python backend port announcement (30s)"
          });
        }
      }, 30000);

      // Clear timeout when port is resolved or process exits
      pythonProcess.on("exit", () => clearTimeout(timeout));

    } catch (error) {
      isStarting = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      resolve({
        success: false,
        error: `Failed to start backend: ${errorMessage}`
      });
    }
  });
}

/**
 * Stops the Python backend subprocess.
 *
 * Attempts graceful shutdown with SIGTERM first, then SIGKILL if
 * the process hasn't exited within the timeout.
 *
 * @param gracefulTimeoutMs - Timeout in milliseconds before SIGKILL (default: 5000)
 * @returns Promise resolving to true if stopped successfully
 */
export async function stopBackend(gracefulTimeoutMs: number = 5000): Promise<boolean> {
  if (!pythonProcess || pythonProcess.killed) {
    return true;
  }

  return new Promise((resolve) => {
    let resolved = false;

    // Set up exit listener
    const onExit = () => {
      if (!resolved) {
        resolved = true;
        backendPort = null;
        processEvents.emit("stopped");
        resolve(true);
      }
    };

    pythonProcess?.once("exit", onExit);

    // Send SIGTERM
    try {
      pythonProcess?.kill("SIGTERM");
    } catch (error) {
      console.error("Error sending SIGTERM:", error);
    }

    // Timeout and send SIGKILL if needed
    setTimeout(() => {
      if (!resolved && pythonProcess && !pythonProcess.killed) {
        try {
          pythonProcess.kill("SIGKILL");
        } catch (error) {
          console.error("Error sending SIGKILL:", error);
        }
      }

      // Force resolve after another short delay
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          backendPort = null;
          resolve(false);
        }
      }, 500);
    }, gracefulTimeoutMs);
  });
}

/**
 * Restarts the Python backend subprocess.
 *
 * Stops the current process if running, then starts a new one.
 *
 * @param dataDir - Path to the OpenNeural data directory
 * @param ephemeralSecret - The 64-character hex secret for request validation
 * @returns Promise resolving to BackendStartResult
 */
export async function restartBackend(
  dataDir: string,
  ephemeralSecret: string
): Promise<BackendStartResult> {
  await stopBackend();
  return startBackend(dataDir, ephemeralSecret);
}

/**
 * Subscribes to process events.
 *
 * @param event - Event name ("starting", "started", "stopped", "exited", "error")
 * @param listener - Event listener function
 */
export function onBackendEvent(
  event: "starting" | "started" | "stopped" | "exited" | "error",
  listener: (...args: unknown[]) => void
): void {
  processEvents.on(event, listener);
}

/**
 * Unsubscribes from process events.
 *
 * @param event - Event name
 * @param listener - Event listener function to remove
 */
export function offBackendEvent(
  event: "starting" | "started" | "stopped" | "exited" | "error",
  listener: (...args: unknown[]) => void
): void {
  processEvents.off(event, listener);
}
