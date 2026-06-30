/**
 * SessionFooter component - displays host machine system information.
 *
 * Shows the OS-reported hostname, total RAM (GB), and CPU model string.
 * Fetches system info from GET /api/v1/system/info on component mount.
 *
 * @module components/SessionFooter
 */
import { useEffect, useState } from "react";
import { useAppStore } from "../stores/appStore";

/**
 * System information response from the backend API.
 */
interface SystemInfo {
  /** Host machine name */
  hostname: string;
  /** Total RAM in gigabytes */
  ram_total_gb: number;
  /** CPU model string */
  cpu_model: string;
  /** Application version */
  app_version: string;
}

/**
 * SessionFooter component displaying system information.
 *
 * Fetches system info once on mount and displays hostname, RAM, and CPU model.
 *
 * @returns The session footer with system information
 */
export function SessionFooter(): JSX.Element {
  const { backendPort, backendSecret } = useAppStore();
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /**
     * Fetch system information from the backend API.
     * Called once on component mount.
     */
    async function fetchSystemInfo() {
      if (!backendPort) {
        setIsLoading(false);
        setError("Backend not connected");
        return;
      }

      try {
        const response = await fetch(
          `http://127.0.0.1:${backendPort}/api/v1/system/info`,
          {
            headers: {
              "Content-Type": "application/json",
              "X-OpenNeural-Secret": backendSecret,
            },
          },
        );

        if (!response.ok) {
          // Endpoint may not exist yet (Task 134)
          if (response.status === 404) {
            console.log(
              "System info endpoint not available yet (Task 134 pending)",
            );
            setError("System info endpoint not available");
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } else {
          const data: SystemInfo = await response.json();
          setSystemInfo(data);
          setError(null);
        }
      } catch (err) {
        console.error("Failed to fetch system info:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSystemInfo();
  }, [backendPort, backendSecret]);

  /**
   * Format RAM value for display.
   *
   * @param gb - RAM in gigabytes
   * @returns Formatted string (e.g., "16 GB")
   */
  function formatRam(gb: number): string {
    if (gb >= 1024) {
      return `${(gb / 1024).toFixed(1)} TB`;
    }
    return `${Math.round(gb)} GB`;
  }

  /**
   * Truncate CPU model string for display.
   *
   * @param model - Full CPU model string
   * @returns Truncated string with ellipsis if needed
   */
  function truncateCpuModel(model: string): string {
    const maxLength = 30;
    if (model.length <= maxLength) return model;
    return `${model.slice(0, maxLength)}...`;
  }

  return (
    <footer
      aria-label="Session information"
      style={styles.footer}
      role="contentinfo"
    >
      {isLoading ? (
        <div aria-live="polite" style={styles.loading}>
          <span style={styles.loadingText}>Loading system info...</span>
        </div>
      ) : error ? (
        <div aria-live="polite" style={styles.error}>
          <span style={styles.errorText}>System info unavailable</span>
        </div>
      ) : systemInfo ? (
        <div style={styles.infoContainer}>
          {/* App Version */}
          <div style={styles.infoItem}>
            <span
              aria-label="Application version"
              style={styles.icon}
              title="App version"
            >
              📦
            </span>
            <span
              style={styles.value}
              title={`OpenNeural v${systemInfo.app_version}`}
            >
              v{systemInfo.app_version}
            </span>
          </div>

          {/* Separator */}
          <span aria-hidden="true" style={styles.separator}>
            |
          </span>

          {/* Hostname */}
          <div style={styles.infoItem}>
            <span
              aria-label="Host machine name"
              style={styles.icon}
              title="Host machine"
            >
              🖥️
            </span>
            <span style={styles.value} title={systemInfo.hostname}>
              {systemInfo.hostname}
            </span>
          </div>

          {/* Separator */}
          <span aria-hidden="true" style={styles.separator}>
            |
          </span>

          {/* RAM */}
          <div style={styles.infoItem}>
            <span aria-label="Total RAM" style={styles.icon} title="Total RAM">
              🧠
            </span>
            <span style={styles.value}>
              {formatRam(systemInfo.ram_total_gb)}
            </span>
          </div>

          {/* Separator */}
          <span aria-hidden="true" style={styles.separator}>
            |
          </span>

          {/* CPU */}
          <div style={styles.infoItem}>
            <span aria-label="CPU model" style={styles.icon} title="CPU model">
              ⚙️
            </span>
            <span style={styles.value} title={systemInfo.cpu_model}>
              {truncateCpuModel(systemInfo.cpu_model)}
            </span>
          </div>
        </div>
      ) : null}
    </footer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  footer: {
    padding: "0.75rem 1rem",
    backgroundColor: "#f9fafb",
    borderTop: "1px solid #e5e7eb",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "20px",
  },
  loadingText: {
    fontStyle: "italic",
    color: "#9ca3af",
  },
  error: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "20px",
  },
  errorText: {
    color: "#dc2626",
    fontStyle: "italic",
  },
  infoContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: "0.5rem",
  },
  infoItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
  },
  icon: {
    fontSize: "0.875rem",
    lineHeight: 1,
  },
  value: {
    fontWeight: 500,
    color: "#374151",
    maxWidth: "150px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  separator: {
    color: "#d1d5db",
    userSelect: "none",
  },
};
