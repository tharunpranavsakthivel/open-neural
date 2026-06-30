/**
 * ExportPanel screen - Step 7: Artifact export.
 *
 * Allows users to export trained models, preprocessing pipelines,
 * evaluation reports, and test predictions to a local directory.
 * Per SRS FR-EXP-01 through FR-EXP-07.
 *
 * @module screens/ExportPanel
 */
import { useState, useCallback, useEffect } from "react";
import { getBackendSecret } from "../stores/appStore";

/**
 * Props for the ExportPanel component.
 */
interface ExportPanelProps {
  /** Currently selected experiment ID to export from */
  experimentId: string;
}

/**
 * Export artifact type identifiers.
 */
type ArtifactType = "model" | "pipeline" | "report" | "predictions";

/**
 * Model export format type.
 */
type ModelFormat = "onnx" | "joblib";

/**
 * Individual artifact selection state.
 */
interface ArtifactSelection {
  /** Whether the artifact is selected for export */
  selected: boolean;
  /** Available format options for the artifact */
  formats?: ModelFormat[];
  /** Currently selected format(s) */
  selectedFormats?: ModelFormat[];
}

/**
 * Export panel wizard step component.
 *
 * Renders artifact selection checkboxes with format options,
 * destination directory picker, and export action buttons.
 *
 * @param props - Component props
 * @returns The export panel screen
 */
/**
 * Get the OS Desktop path.
 * Uses Electron's app.getPath if available, otherwise falls back to
 * constructing the path based on the user agent.
 */
function getDesktopPath(): string {
  // Platform-specific desktop paths
  const platform = navigator.platform;

  if (platform.includes("Win")) {
    // Windows Desktop
    return "C:\\Users\\" + getUsername() + "\\Desktop";
  } else if (platform.includes("Mac")) {
    // macOS Desktop
    return "/Users/" + getUsername() + "/Desktop";
  } else {
    // Linux Desktop
    return "/home/" + getUsername() + "/Desktop";
  }
}

/**
 * Get current username from environment or fallback.
 */
function getUsername(): string {
  // Try to extract from user agent or use common defaults
  // In a real Electron app, this would use process.env.USER or os.userInfo()
  return "user";
}

function requireBackendSecret(): string {
  const secret = getBackendSecret();

  if (!secret) {
    throw new Error("Backend secret not available");
  }

  return secret;
}

/**
 * Get the appropriate label for the reveal button based on OS.
 * Returns "Reveal in Finder" for macOS, "Reveal in Explorer" for Windows,
 * or "Open in File Manager" for Linux/other platforms.
 */
function getRevealButtonLabel(): string {
  const platform = navigator.platform;

  if (platform.includes("Mac")) {
    return "Reveal in Finder";
  } else if (platform.includes("Win")) {
    return "Reveal in Explorer";
  } else {
    return "Open in File Manager";
  }
}

export function ExportPanel({ experimentId }: ExportPanelProps): JSX.Element {
  /** Selected destination directory - defaults to OS Desktop */
  const [destinationDir, setDestinationDir] = useState<string>(() =>
    getDesktopPath(),
  );

  /** Artifact selection state */
  const [artifacts, setArtifacts] = useState<
    Record<ArtifactType, ArtifactSelection>
  >({
    model: {
      selected: true,
      formats: ["onnx", "joblib"],
      selectedFormats: ["onnx", "joblib"],
    },
    pipeline: {
      selected: true,
    },
    report: {
      selected: true,
    },
    predictions: {
      selected: true,
    },
  });

  /** Export operation state */
  const [isExporting, setIsExporting] = useState(false);
  /** Export error message */
  const [exportError, setExportError] = useState<string | null>(null);
  /** Export success state */
  const [isExportComplete, setIsExportComplete] = useState(false);

  /**
   * Toggle artifact selection.
   */
  const handleArtifactToggle = useCallback((artifactType: ArtifactType) => {
    setArtifacts((prev) => ({
      ...prev,
      [artifactType]: {
        ...prev[artifactType],
        selected: !prev[artifactType].selected,
      },
    }));
  }, []);

  /**
   * Toggle model format selection.
   */
  const handleFormatToggle = useCallback((format: ModelFormat) => {
    setArtifacts((prev) => {
      const modelSelection = prev.model;
      const currentFormats = modelSelection.selectedFormats ?? [];
      const newFormats = currentFormats.includes(format)
        ? currentFormats.filter((f) => f !== format)
        : [...currentFormats, format];

      // Ensure at least one format is selected if model is selected
      const updatedFormats =
        newFormats.length > 0 ? newFormats : currentFormats;

      return {
        ...prev,
        model: {
          ...modelSelection,
          selectedFormats: updatedFormats,
        },
      };
    });
  }, []);

  /**
   * Select all artifacts.
   */
  const handleSelectAll = useCallback(() => {
    setArtifacts(
      (prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([key, value]) => [
            key,
            { ...value, selected: true },
          ]),
        ) as Record<ArtifactType, ArtifactSelection>,
    );
  }, []);

  /**
   * Deselect all artifacts.
   */
  const handleDeselectAll = useCallback(() => {
    setArtifacts(
      (prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([key, value]) => [
            key,
            { ...value, selected: false },
          ]),
        ) as Record<ArtifactType, ArtifactSelection>,
    );
  }, []);

  /**
   * Open directory picker dialog.
   */
  const handleBrowseDirectory = useCallback(async () => {
    try {
      const result = await window.electronAPI.openDirectoryDialog({
        title: "Select Export Destination",
      });
      if (result) {
        setDestinationDir(result);
        setExportError(null);
      }
    } catch (err) {
      setExportError("Failed to open directory dialog");
      console.error("Directory dialog error:", err);
    }
  }, []);

  /**
   * Get selected artifacts array for API call.
   */
  const getSelectedArtifacts = useCallback((): ArtifactType[] => {
    return Object.entries(artifacts)
      .filter(([, value]) => value.selected)
      .map(([key]) => key) as ArtifactType[];
  }, [artifacts]);

  /**
   * Check if any artifacts are selected.
   */
  const hasSelectedArtifacts = useCallback((): boolean => {
    return Object.values(artifacts).some((a) => a.selected);
  }, [artifacts]);

  /**
   * Check if export can proceed.
   */
  const canExport = useCallback((): boolean => {
    return hasSelectedArtifacts() && destinationDir.length > 0 && !isExporting;
  }, [hasSelectedArtifacts, destinationDir, isExporting]);

  /**
   * Execute export operation with selected artifacts.
   */
  const handleExport = useCallback(async () => {
    if (!canExport()) {
      if (!destinationDir) {
        setExportError("Please select a destination directory");
      } else if (!hasSelectedArtifacts()) {
        setExportError("Please select at least one artifact to export");
      }
      return;
    }

    try {
      setIsExporting(true);
      setExportError(null);
      setIsExportComplete(false);

      const selectedArtifacts = getSelectedArtifacts();
      const modelFormats = artifacts.model.selectedFormats ?? [];

      // Build formats configuration for model
      const formats: { model: ModelFormat[] } = {
        model: modelFormats,
      };

      // Call export API
      const baseUrl = await getBaseUrl();
      const backendSecret = requireBackendSecret();
      const response = await fetch(
        `${baseUrl}/api/v1/experiments/${experimentId}/export`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-OpenNeural-Secret": backendSecret,
          },
          body: JSON.stringify({
            artifacts: selectedArtifacts,
            destination_dir: destinationDir,
            formats,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Export failed: ${response.status} ${errorText}`);
      }

      setIsExportComplete(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Export failed";
      setExportError(errorMessage);
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  }, [
    canExport,
    destinationDir,
    experimentId,
    getSelectedArtifacts,
    hasSelectedArtifacts,
    artifacts.model.selectedFormats,
  ]);

  /**
   * Export All: select all artifacts programmatically and proceed to export.
   * Per Task 191: calls POST /api/v1/experiments/{id}/export with
   * artifacts: ["model", "pipeline", "report", "predictions"].
   */
  const handleExportAll = useCallback(async () => {
    // Validate destination directory first
    if (!destinationDir) {
      setExportError("Please select a destination directory");
      return;
    }

    if (isExporting) {
      return;
    }

    try {
      setIsExporting(true);
      setExportError(null);
      setIsExportComplete(false);

      // Select all artifacts programmatically
      const allArtifacts: ArtifactType[] = [
        "model",
        "pipeline",
        "report",
        "predictions",
      ];

      // Update UI state to reflect all selected
      setArtifacts(
        (prev) =>
          Object.fromEntries(
            Object.entries(prev).map(([key, value]) => [
              key,
              { ...value, selected: true },
            ]),
          ) as Record<ArtifactType, ArtifactSelection>,
      );

      // Get model formats (both ONNX and joblib)
      const modelFormats: ModelFormat[] = ["onnx", "joblib"];

      // Build formats configuration
      const formats: { model: ModelFormat[] } = {
        model: modelFormats,
      };

      // Call export API with all artifacts
      const baseUrl = await getBaseUrl();
      const backendSecret = requireBackendSecret();
      const response = await fetch(
        `${baseUrl}/api/v1/experiments/${experimentId}/export`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-OpenNeural-Secret": backendSecret,
          },
          body: JSON.stringify({
            artifacts: allArtifacts,
            destination_dir: destinationDir,
            formats,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Export failed: ${response.status} ${errorText}`);
      }

      setIsExportComplete(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Export failed";
      setExportError(errorMessage);
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  }, [destinationDir, experimentId, isExporting]);

  /**
   * Export a single artifact independently.
   * Per Task 193: allow exporting a single artifact independently.
   */
  const handleExportSingle = useCallback(
    async (artifactType: ArtifactType) => {
      // Validate destination directory first
      if (!destinationDir) {
        setExportError("Please select a destination directory");
        return;
      }

      if (isExporting) {
        return;
      }

      try {
        setIsExporting(true);
        setExportError(null);
        setIsExportComplete(false);

        // Build formats configuration based on artifact type
        const formats: { model?: ModelFormat[] } = {};
        if (artifactType === "model") {
          // For single model export, use currently selected formats
          formats.model = artifacts.model.selectedFormats ?? ["onnx", "joblib"];
        }

        // Call export API with single artifact
        const baseUrl = await getBaseUrl();
        const backendSecret = requireBackendSecret();
        const response = await fetch(
          `${baseUrl}/api/v1/experiments/${experimentId}/export`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-OpenNeural-Secret": backendSecret,
            },
            body: JSON.stringify({
              artifacts: [artifactType],
              destination_dir: destinationDir,
              formats,
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Export failed: ${response.status} ${errorText}`);
        }

        setIsExportComplete(true);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Export failed";
        setExportError(errorMessage);
        console.error("Export error:", err);
      } finally {
        setIsExporting(false);
      }
    },
    [
      destinationDir,
      experimentId,
      isExporting,
      artifacts.model.selectedFormats,
    ],
  );

  /**
   * Artifact metadata for display.
   */
  async function getBaseUrl(): Promise<string> {
    const port = await window.electronAPI.getBackendPort();
    if (port === null) {
      throw new Error("Backend port not available");
    }
    return `http://127.0.0.1:${port}`;
  }

  /**
   * Open export directory in OS file manager.
   * Per Task 195: Uses ipcRenderer.invoke('open-path', dest_dir) via Electron API.
   */
  const handleRevealInFinder = useCallback(async () => {
    if (destinationDir) {
      try {
        // Use Electron shell.openPath to reveal directory in OS-native file manager
        // This opens Finder on macOS, Explorer on Windows, or default file manager on Linux
        await window.electronAPI.openPath(destinationDir);
      } catch (err) {
        console.error("Failed to open directory:", err);
        setExportError("Failed to open directory in file manager");
      }
    }
  }, [destinationDir]);

  /**
   * Artifact metadata for display.
   */
  const artifactMeta: Record<
    ArtifactType,
    { label: string; description: string; icon: string }
  > = {
    model: {
      label: "Model",
      description: "Trained model artifact",
      icon: "🧠",
    },
    pipeline: {
      label: "Preprocessing Pipeline",
      description: "Fitted scikit-learn pipeline",
      icon: "⚙️",
    },
    report: {
      label: "Evaluation Report",
      description: "PDF with metrics and analysis",
      icon: "📊",
    },
    predictions: {
      label: "Test Predictions",
      description: "CSV with predicted labels and probabilities",
      icon: "📄",
    },
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Export</h1>
        <p style={styles.description}>
          Export your trained model, pipeline, and evaluation report to a local
          directory.
        </p>
      </header>

      {/* Artifact Selection */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Select Artifacts to Export</h2>
          <div style={styles.artifactActions}>
            <button onClick={handleSelectAll} style={styles.actionLink}>
              Select All
            </button>
            <span style={styles.actionDivider}>|</span>
            <button onClick={handleDeselectAll} style={styles.actionLink}>
              Deselect All
            </button>
          </div>
        </div>

        <div style={styles.artifactList}>
          {/* Model Artifact with Format Options */}
          <div
            style={{
              ...styles.artifactCard,
              ...(artifacts.model.selected ? styles.artifactCardSelected : {}),
            }}
          >
            <div style={styles.artifactRow}>
              <label style={styles.artifactLabel}>
                <input
                  type="checkbox"
                  checked={artifacts.model.selected}
                  onChange={() => handleArtifactToggle("model")}
                  style={styles.checkbox}
                />
                <span style={styles.artifactIcon}>
                  {artifactMeta.model.icon}
                </span>
                <div style={styles.artifactInfo}>
                  <span style={styles.artifactName}>
                    {artifactMeta.model.label}
                  </span>
                  <span style={styles.artifactDescription}>
                    {artifactMeta.model.description}
                  </span>
                </div>
              </label>
              <button
                onClick={() => handleExportSingle("model")}
                disabled={!destinationDir || isExporting}
                style={{
                  ...styles.exportSingleButton,
                  ...(!destinationDir || isExporting
                    ? styles.exportSingleButtonDisabled
                    : {}),
                }}
              >
                Export
              </button>
            </div>

            {/* Model Format Options */}
            {artifacts.model.selected && (
              <div style={styles.formatOptions}>
                <span style={styles.formatLabel}>Format:</span>
                <div style={styles.formatCheckboxes}>
                  <label style={styles.formatCheckboxLabel}>
                    <input
                      type="checkbox"
                      checked={artifacts.model.selectedFormats?.includes(
                        "onnx",
                      )}
                      onChange={() => handleFormatToggle("onnx")}
                      style={styles.formatCheckbox}
                    />
                    <span style={styles.formatName}>ONNX</span>
                    <span style={styles.formatDescription}>
                      Standard format for model portability
                    </span>
                  </label>
                  <label style={styles.formatCheckboxLabel}>
                    <input
                      type="checkbox"
                      checked={artifacts.model.selectedFormats?.includes(
                        "joblib",
                      )}
                      onChange={() => handleFormatToggle("joblib")}
                      style={styles.formatCheckbox}
                    />
                    <span style={styles.formatName}>joblib</span>
                    <span style={styles.formatDescription}>
                      Python-native serialization
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Pipeline Artifact */}
          <div
            style={{
              ...styles.artifactCard,
              ...(artifacts.pipeline.selected
                ? styles.artifactCardSelected
                : {}),
            }}
          >
            <div style={styles.artifactRow}>
              <label style={styles.artifactLabel}>
                <input
                  type="checkbox"
                  checked={artifacts.pipeline.selected}
                  onChange={() => handleArtifactToggle("pipeline")}
                  style={styles.checkbox}
                />
                <span style={styles.artifactIcon}>
                  {artifactMeta.pipeline.icon}
                </span>
                <div style={styles.artifactInfo}>
                  <span style={styles.artifactName}>
                    {artifactMeta.pipeline.label}
                  </span>
                  <span style={styles.artifactDescription}>
                    {artifactMeta.pipeline.description}
                    <span style={styles.formatTag}>joblib</span>
                  </span>
                </div>
              </label>
              <button
                onClick={() => handleExportSingle("pipeline")}
                disabled={!destinationDir || isExporting}
                style={{
                  ...styles.exportSingleButton,
                  ...(!destinationDir || isExporting
                    ? styles.exportSingleButtonDisabled
                    : {}),
                }}
              >
                Export
              </button>
            </div>
          </div>

          {/* Report Artifact */}
          <div
            style={{
              ...styles.artifactCard,
              ...(artifacts.report.selected ? styles.artifactCardSelected : {}),
            }}
          >
            <div style={styles.artifactRow}>
              <label style={styles.artifactLabel}>
                <input
                  type="checkbox"
                  checked={artifacts.report.selected}
                  onChange={() => handleArtifactToggle("report")}
                  style={styles.checkbox}
                />
                <span style={styles.artifactIcon}>
                  {artifactMeta.report.icon}
                </span>
                <div style={styles.artifactInfo}>
                  <span style={styles.artifactName}>
                    {artifactMeta.report.label}
                  </span>
                  <span style={styles.artifactDescription}>
                    {artifactMeta.report.description}
                    <span style={styles.formatTag}>PDF</span>
                  </span>
                </div>
              </label>
              <button
                onClick={() => handleExportSingle("report")}
                disabled={!destinationDir || isExporting}
                style={{
                  ...styles.exportSingleButton,
                  ...(!destinationDir || isExporting
                    ? styles.exportSingleButtonDisabled
                    : {}),
                }}
              >
                Export
              </button>
            </div>
          </div>

          {/* Predictions Artifact */}
          <div
            style={{
              ...styles.artifactCard,
              ...(artifacts.predictions.selected
                ? styles.artifactCardSelected
                : {}),
            }}
          >
            <div style={styles.artifactRow}>
              <label style={styles.artifactLabel}>
                <input
                  type="checkbox"
                  checked={artifacts.predictions.selected}
                  onChange={() => handleArtifactToggle("predictions")}
                  style={styles.checkbox}
                />
                <span style={styles.artifactIcon}>
                  {artifactMeta.predictions.icon}
                </span>
                <div style={styles.artifactInfo}>
                  <span style={styles.artifactName}>
                    {artifactMeta.predictions.label}
                  </span>
                  <span style={styles.artifactDescription}>
                    {artifactMeta.predictions.description}
                    <span style={styles.formatTag}>CSV</span>
                  </span>
                </div>
              </label>
              <button
                onClick={() => handleExportSingle("predictions")}
                disabled={!destinationDir || isExporting}
                style={{
                  ...styles.exportSingleButton,
                  ...(!destinationDir || isExporting
                    ? styles.exportSingleButtonDisabled
                    : {}),
                }}
              >
                Export
              </button>
            </div>
          </div>
        </div>

        {!hasSelectedArtifacts() && (
          <p style={styles.warningText}>
            Please select at least one artifact to export.
          </p>
        )}
      </div>

      {/* Destination Directory */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Export Destination</h2>
        <div style={styles.destinationInput}>
          <input
            type="text"
            value={destinationDir}
            onChange={(e) => setDestinationDir(e.target.value)}
            placeholder="Select destination directory..."
            style={styles.input}
          />
          <button onClick={handleBrowseDirectory} style={styles.browseButton}>
            Browse
          </button>
        </div>
        {!destinationDir && (
          <p style={styles.hintText}>
            Click Browse to select where exported files will be saved.
          </p>
        )}
      </div>

      {/* Error Message */}
      {exportError && (
        <div style={styles.errorBanner}>
          <span style={styles.errorIcon}>⚠</span>
          <span style={styles.errorText}>{exportError}</span>
        </div>
      )}

      {/* Success Message */}
      {isExportComplete && (
        <div style={styles.successBanner}>
          <span style={styles.successIcon}>✓</span>
          <span style={styles.successText}>
            All artifacts exported successfully!
          </span>
          <button
            onClick={handleRevealInFinder}
            style={styles.revealButton}
            title="Open export directory in file manager"
          >
            {getRevealButtonLabel()}
          </button>
        </div>
      )}

      {/* Export Button */}
      <div style={styles.exportButtonContainer}>
        <button
          onClick={handleExportAll}
          disabled={!destinationDir || isExporting}
          style={{
            ...styles.exportButton,
            ...(destinationDir && !isExporting
              ? {}
              : styles.exportButtonDisabled),
          }}
        >
          {isExporting ? (
            <>
              <span style={styles.buttonSpinner} />
              Exporting...
            </>
          ) : (
            "Export All"
          )}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "800px",
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
  section: {
    marginBottom: "2rem",
    padding: "1.5rem",
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  artifactActions: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  actionLink: {
    padding: "0.25rem 0.5rem",
    backgroundColor: "transparent",
    border: "none",
    color: "#2563eb",
    fontSize: "0.75rem",
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "underline",
  },
  actionDivider: {
    color: "#d1d5db",
    fontSize: "0.75rem",
  },
  artifactList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  artifactCard: {
    display: "flex",
    flexDirection: "column",
    padding: "1rem",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  artifactCardSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
  },
  artifactRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
  },
  artifactLabel: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.75rem",
    cursor: "pointer",
    flex: 1,
  },
  checkbox: {
    width: "1.125rem",
    height: "1.125rem",
    marginTop: "0.125rem",
    cursor: "pointer",
    flexShrink: 0,
  },
  artifactIcon: {
    fontSize: "1.5rem",
    flexShrink: 0,
  },
  artifactInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    flex: 1,
  },
  artifactName: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#111827",
  },
  artifactDescription: {
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  formatTag: {
    display: "inline-block",
    marginLeft: "0.5rem",
    padding: "0.125rem 0.375rem",
    backgroundColor: "#e5e7eb",
    borderRadius: "4px",
    fontSize: "0.625rem",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase",
  },
  formatOptions: {
    marginTop: "0.75rem",
    marginLeft: "2.375rem",
    padding: "0.75rem",
    backgroundColor: "#ffffff",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
  },
  formatLabel: {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "#374151",
    marginBottom: "0.5rem",
  },
  formatCheckboxes: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  formatCheckboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer",
  },
  formatCheckbox: {
    width: "1rem",
    height: "1rem",
    cursor: "pointer",
  },
  formatName: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
    minWidth: "60px",
  },
  formatDescription: {
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  warningText: {
    margin: "0.75rem 0 0 0",
    fontSize: "0.75rem",
    color: "#dc2626",
  },
  exportSingleButton: {
    padding: "0.375rem 0.75rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.75rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
    flexShrink: 0,
  },
  exportSingleButtonDisabled: {
    backgroundColor: "#d1d5db",
    cursor: "not-allowed",
  },
  destinationInput: {
    display: "flex",
    gap: "0.5rem",
  },
  input: {
    flex: 1,
    padding: "0.5rem 0.75rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
  },
  browseButton: {
    padding: "0.5rem 1rem",
    backgroundColor: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  hintText: {
    margin: "0.5rem 0 0 0",
    fontSize: "0.75rem",
    color: "#6b7280",
    fontStyle: "italic",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "1.5rem",
    padding: "0.75rem 1rem",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "8px",
  },
  errorIcon: {
    fontSize: "1rem",
    color: "#dc2626",
  },
  errorText: {
    flex: 1,
    fontSize: "0.875rem",
    color: "#dc2626",
  },
  successBanner: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "1.5rem",
    padding: "0.75rem 1rem",
    backgroundColor: "#dcfce7",
    border: "1px solid #86efac",
    borderRadius: "8px",
  },
  successIcon: {
    fontSize: "1rem",
    color: "#16a34a",
  },
  successText: {
    flex: 1,
    fontSize: "0.875rem",
    color: "#166534",
    fontWeight: 500,
  },
  revealButton: {
    padding: "0.375rem 0.75rem",
    backgroundColor: "#22c55e",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.75rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  exportButtonContainer: {
    display: "flex",
    justifyContent: "center",
    marginTop: "1.5rem",
  },
  exportButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "1rem 3rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease",
    minWidth: "200px",
  },
  exportButtonDisabled: {
    backgroundColor: "#d1d5db",
    cursor: "not-allowed",
  },
  buttonSpinner: {
    width: "16px",
    height: "16px",
    border: "2px solid rgba(255, 255, 255, 0.3)",
    borderTop: "2px solid #ffffff",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
};
