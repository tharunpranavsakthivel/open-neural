import * as path from "path";

/**
 * Resolves the path to the Python executable or compiled binary.
 *
 * In development, returns "python" to execute the raw python process from the user's environment.
 * In production, returns the absolute path to the packaged PyInstaller binary inside process.resourcesPath.
 *
 * @returns {string} The path to the python executable or compiled binary.
 */
export function getPythonExecutable(): string {
  if (process.env.NODE_ENV === "development") {
    return "python";
  }

  const isWindows = process.platform === "win32";
  const exeName = isWindows ? "openneural_backend.exe" : "openneural_backend";

  // process.resourcesPath is /Applications/OpenNeural.app/Contents/Resources on macOS.
  // extraResources places the bundle in the "backend" subdirectory.
  // PyInstaller bundle name is openneural_backend, so the executable is at backend/openneural_backend
  return path.join(process.resourcesPath, "backend", exeName);
}
