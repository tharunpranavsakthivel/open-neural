/**
 * Toast component - displays temporary notification messages.
 *
 * Shows success or error toast notifications that auto-dismiss after a timeout.
 * Used for user feedback after actions like password setup, login, etc.
 *
 * @module components/Toast
 */
import { useEffect } from "react";
import { useAppStore } from "../stores/appStore";

/**
 * Toast notification component.
 *
 * Displays toast messages from the app store and auto-dismisses after 5 seconds.
 *
 * @returns The toast notification or null if no toast
 */
export function Toast(): JSX.Element | null {
  const { toast, clearToast } = useAppStore();

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      clearToast();
    }, 5000);

    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) {
    return null;
  }

  const isSuccess = toast.type === "success";

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        ...styles.container,
        ...(isSuccess ? styles.success : styles.error),
      }}
    >
      <div style={styles.content}>
        <span style={styles.icon} aria-hidden="true">
          {isSuccess ? "✓" : "✕"}
        </span>
        <span style={styles.message}>{toast.message}</span>
      </div>
      <button
        onClick={clearToast}
        aria-label="Dismiss notification"
        style={styles.closeButton}
      >
        ×
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    top: "1rem",
    right: "1rem",
    padding: "1rem 1.25rem",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    zIndex: 1001,
    animation: "toastSlideIn 0.3s ease-out",
    minWidth: "300px",
    maxWidth: "500px",
  },
  success: {
    backgroundColor: "#dcfce7",
    border: "1px solid #86efac",
    color: "#166534",
  },
  error: {
    backgroundColor: "#fee2e2",
    border: "1px solid #fca5a5",
    color: "#991b1b",
  },
  content: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    flex: 1,
  },
  icon: {
    fontSize: "1rem",
    fontWeight: 600,
  },
  message: {
    fontSize: "0.875rem",
    fontWeight: 500,
  },
  closeButton: {
    background: "none",
    border: "none",
    fontSize: "1.25rem",
    cursor: "pointer",
    padding: "0 0.25rem",
    opacity: 0.6,
    transition: "opacity 0.15s ease",
  },
};
