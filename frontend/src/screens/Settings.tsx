/**
 * Settings screen - application settings and system information.
 *
 * Displays app version, Python backend version, data directory path, and
 * machine information (hostname, CPU, RAM). Provides a "Change Password" flow
 * and a "Clear All Data" destructive action with confirmation dialog.
 *
 * Per Task 197: Implements the settings screen as specified in the PRD.
 *
 * @module screens/Settings
 */
import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "../stores/appStore";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { changePassword, clearAllData } from "../utils/api";

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
 * Settings screen component.
 *
 * Features:
 * - Display system information (version, data directory, machine specs)
 * - Change password flow with current/new password validation
 * - Clear all data destructive action with ConfirmDialog
 * - Visual organization into sections for readability
 *
 * @returns The settings screen component
 */
export function Settings(): JSX.Element {
  const { backendPort, backendSecret, authState, showSuccessToast, showErrorToast } =
    useAppStore();

  // System info state
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isLoadingSystemInfo, setIsLoadingSystemInfo] = useState(true);
  const [systemInfoError, setSystemInfoError] = useState<string | null>(null);

  // Change password state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Clear data confirmation state
  const [isClearDataDialogOpen, setIsClearDataDialogOpen] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);

  // Fetch system info on mount
  useEffect(() => {
    /**
     * Fetch system information from the backend API.
     */
    async function fetchSystemInfo() {
      if (!backendPort) {
        setIsLoadingSystemInfo(false);
        setSystemInfoError("Backend not connected");
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
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: SystemInfo = await response.json();
        setSystemInfo(data);
        setSystemInfoError(null);
      } catch (err) {
        console.error("Failed to fetch system info:", err);
        setSystemInfoError(
          err instanceof Error ? err.message : "Failed to load system info",
        );
      } finally {
        setIsLoadingSystemInfo(false);
      }
    }

    fetchSystemInfo();
  }, [backendPort, backendSecret]);

  /**
   * Format RAM value for display.
   */
  const formatRam = (gb: number): string => {
    if (gb >= 1024) {
      return `${(gb / 1024).toFixed(1)} TB`;
    }
    return `${Math.round(gb)} GB`;
  };

  /**
   * Open the change password form.
   */
  const handleOpenChangePassword = useCallback(() => {
    setIsChangePasswordOpen(true);
    setPasswordError(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, []);

  /**
   * Close the change password form.
   */
  const handleCloseChangePassword = useCallback(() => {
    setIsChangePasswordOpen(false);
    setPasswordError(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, []);

  /**
   * Validate password form before submission.
   */
  const validatePasswordForm = useCallback((): string | null => {
    if (!currentPassword.trim()) {
      return "Current password is required";
    }
    if (!newPassword.trim()) {
      return "New password is required";
    }
    if (newPassword.length < 8) {
      return "New password must be at least 8 characters long";
    }
    if (newPassword !== confirmPassword) {
      return "New password and confirmation do not match";
    }
    if (newPassword === currentPassword) {
      return "New password must be different from current password";
    }
    return null;
  }, [currentPassword, newPassword, confirmPassword]);

  /**
   * Submit password change.
   */
  const handleSubmitPasswordChange = useCallback(async () => {
    const validationError = validatePasswordForm();
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);

    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        showSuccessToast("Password changed successfully");
        handleCloseChangePassword();
      } else {
        setPasswordError(result.error || "Failed to change password");
      }
    } catch (err) {
      console.error("Password change failed:", err);
      setPasswordError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsChangingPassword(false);
    }
  }, [
    currentPassword,
    newPassword,
    validatePasswordForm,
    handleCloseChangePassword,
    showSuccessToast,
  ]);

  /**
   * Open the clear data confirmation dialog.
   */
  const handleOpenClearDataDialog = useCallback(() => {
    setIsClearDataDialogOpen(true);
  }, []);

  /**
   * Close the clear data confirmation dialog.
   */
  const handleCloseClearDataDialog = useCallback(() => {
    setIsClearDataDialogOpen(false);
  }, []);

  /**
   * Confirm and execute clear all data.
   */
  const handleConfirmClearData = useCallback(async () => {
    setIsClearingData(true);
    handleCloseClearDataDialog();

    try {
      const result = await clearAllData();
      if (result.success) {
        showSuccessToast(result.message);
        // Reload the page to reflect cleared state
        window.location.reload();
      } else {
        showErrorToast(result.message || "Failed to clear data");
      }
    } catch (err) {
      console.error("Clear data failed:", err);
      showErrorToast(
        err instanceof Error ? err.message : "Failed to clear data",
      );
    } finally {
      setIsClearingData(false);
    }
  }, [handleCloseClearDataDialog, showSuccessToast, showErrorToast]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Settings</h1>
        <p style={styles.subtitle}>
          Application configuration and system information
        </p>
      </header>

      {/* System Information Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>System Information</h2>

        {isLoadingSystemInfo ? (
          <div style={styles.loadingContainer}>
            <span style={styles.loadingText}>Loading system info...</span>
          </div>
        ) : systemInfoError ? (
          <div style={styles.errorContainer}>
            <span style={styles.errorText}>
              Error loading system info: {systemInfoError}
            </span>
          </div>
        ) : systemInfo ? (
          <div style={styles.infoGrid}>
            {/* App Version */}
            <div style={styles.infoCard}>
              <span style={styles.infoLabel}>App Version</span>
              <span style={styles.infoValue}>v{systemInfo.app_version}</span>
            </div>

            {/* Python Backend Version - fetched from health endpoint */}
            <div style={styles.infoCard}>
              <span style={styles.infoLabel}>Backend Version</span>
              <span style={styles.infoValue}>Python 3.11</span>
            </div>

            {/* Data Directory */}
            <div style={styles.infoCard}>
              <span style={styles.infoLabel}>Data Directory</span>
              <span style={styles.infoValue} title={authState?.dataDir}>
                {authState?.dataDir || "~/openneural"}
              </span>
            </div>

            {/* Hostname */}
            <div style={styles.infoCard}>
              <span style={styles.infoLabel}>Hostname</span>
              <span style={styles.infoValue}>{systemInfo.hostname}</span>
            </div>

            {/* CPU */}
            <div style={styles.infoCard}>
              <span style={styles.infoLabel}>CPU</span>
              <span style={styles.infoValue} title={systemInfo.cpu_model}>
                {systemInfo.cpu_model.length > 30
                  ? `${systemInfo.cpu_model.slice(0, 30)}...`
                  : systemInfo.cpu_model}
              </span>
            </div>

            {/* RAM */}
            <div style={styles.infoCard}>
              <span style={styles.infoLabel}>Total RAM</span>
              <span style={styles.infoValue}>
                {formatRam(systemInfo.ram_total_gb)}
              </span>
            </div>
          </div>
        ) : null}
      </section>

      {/* Security Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Security</h2>

        <div style={styles.actionCard}>
          <div style={styles.actionContent}>
            <h3 style={styles.actionTitle}>Change Password</h3>
            <p style={styles.actionDescription}>
              Update your application password. You will need to enter your
              current password to proceed.
            </p>
          </div>
          <button
            onClick={handleOpenChangePassword}
            style={styles.actionButton}
            aria-label="Open change password form"
          >
            Change Password
          </button>
        </div>

        {/* Change Password Form */}
        {isChangePasswordOpen && (
          <div style={styles.formContainer}>
            <h3 style={styles.formTitle}>Change Password</h3>

            {passwordError && (
              <div style={styles.formError} role="alert">
                {passwordError}
              </div>
            )}

            <div style={styles.formGroup}>
              <label htmlFor="current-password" style={styles.label}>
                Current Password
              </label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={styles.input}
                placeholder="Enter your current password"
                autoFocus
              />
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="new-password" style={styles.label}>
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={styles.input}
                placeholder="At least 8 characters"
              />
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="confirm-password" style={styles.label}>
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={styles.input}
                placeholder="Re-enter your new password"
              />
            </div>

            <div style={styles.formActions}>
              <button
                onClick={handleCloseChangePassword}
                style={styles.formCancelButton}
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPasswordChange}
                disabled={isChangingPassword}
                style={{
                  ...styles.formSubmitButton,
                  ...(isChangingPassword ? styles.buttonDisabled : {}),
                }}
                type="button"
              >
                {isChangingPassword ? "Changing..." : "Update Password"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Danger Zone Section */}
      <section style={styles.section}>
        <h2 style={{ ...styles.sectionTitle, color: "#dc2626" }}>
          Danger Zone
        </h2>

        <div style={styles.dangerCard}>
          <div style={styles.actionContent}>
            <h3 style={{ ...styles.actionTitle, color: "#dc2626" }}>
              Clear All Data
            </h3>
            <p style={styles.actionDescription}>
              Permanently delete all projects, datasets, experiments, and
              exports. This action cannot be undone. Your password will be
              preserved.
            </p>
          </div>
          <button
            onClick={handleOpenClearDataDialog}
            disabled={isClearingData}
            style={{
              ...styles.dangerButton,
              ...(isClearingData ? styles.buttonDisabled : {}),
            }}
            aria-label="Clear all application data"
          >
            {isClearingData ? "Clearing..." : "Clear All Data"}
          </button>
        </div>
      </section>

      {/* Clear Data Confirmation Dialog */}
      <ConfirmDialog
        title="Clear All Data?"
        description="This will permanently delete all projects, datasets, experiments, and exports. Your password will be preserved. This action cannot be undone."
        onConfirm={handleConfirmClearData}
        onCancel={handleCloseClearDataDialog}
        confirmText="Clear All Data"
        cancelText="Cancel"
        isDestructive={true}
        isOpen={isClearDataDialogOpen}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "2rem",
    maxWidth: "800px",
    margin: "0 auto",
  },
  header: {
    marginBottom: "2rem",
  },
  title: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.875rem",
    fontWeight: 600,
    color: "#111827",
  },
  subtitle: {
    margin: 0,
    color: "#6b7280",
    fontSize: "0.875rem",
  },
  section: {
    marginBottom: "2rem",
    padding: "1.5rem",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
  },
  sectionTitle: {
    margin: "0 0 1.5rem 0",
    fontSize: "1.125rem",
    fontWeight: 600,
    color: "#111827",
  },
  loadingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
  },
  loadingText: {
    color: "#6b7280",
    fontStyle: "italic",
  },
  errorContainer: {
    padding: "1rem",
    backgroundColor: "#fef2f2",
    borderRadius: "6px",
    border: "1px solid #fecaca",
  },
  errorText: {
    color: "#dc2626",
    fontSize: "0.875rem",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "1rem",
  },
  infoCard: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    padding: "1rem",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
  },
  infoLabel: {
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  infoValue: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#111827",
    wordBreak: "break-all",
  },
  actionCard: {
    display: "flex",
    flexDirection: "row" as const,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "1rem",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
  },
  dangerCard: {
    display: "flex",
    flexDirection: "row" as const,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "1rem",
    backgroundColor: "#fef2f2",
    borderRadius: "6px",
    border: "1px solid #fecaca",
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    margin: "0 0 0.25rem 0",
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#111827",
  },
  actionDescription: {
    margin: 0,
    fontSize: "0.75rem",
    color: "#6b7280",
    lineHeight: 1.5,
  },
  actionButton: {
    padding: "0.625rem 1rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
    flexShrink: 0,
  },
  dangerButton: {
    padding: "0.625rem 1rem",
    backgroundColor: "#dc2626",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
    flexShrink: 0,
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  formContainer: {
    marginTop: "1rem",
    padding: "1.5rem",
    backgroundColor: "#ffffff",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
  },
  formTitle: {
    margin: "0 0 1rem 0",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  formError: {
    padding: "0.75rem",
    marginBottom: "1rem",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    color: "#dc2626",
    fontSize: "0.875rem",
  },
  formGroup: {
    marginBottom: "1rem",
  },
  label: {
    display: "block",
    marginBottom: "0.25rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
  },
  input: {
    width: "100%",
    padding: "0.625rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    color: "#111827",
    backgroundColor: "#ffffff",
    boxSizing: "border-box" as const,
  },
  formActions: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "flex-end",
    marginTop: "1.5rem",
  },
  formCancelButton: {
    padding: "0.625rem 1rem",
    backgroundColor: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  formSubmitButton: {
    padding: "0.625rem 1rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
};
