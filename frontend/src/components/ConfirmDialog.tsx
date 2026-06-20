/**
 * ConfirmDialog component - reusable modal for destructive operations.
 *
 * Displays a confirmation dialog with title, description, and confirm/cancel
 * buttons. Provides visual warning for destructive actions like delete,
 * discard, or cancel operations. Required before all destructive operations
 * per the Destructive Operation Protocol (INSTRUCTIONS.md §21).
 *
 * @module components/ConfirmDialog
 */
import { useEffect, useRef, useCallback } from "react";

export interface ConfirmDialogProps {
  /** Dialog title text */
  title: string;
  /** Dialog description/explanation */
  description: string;
  /** Callback when user confirms the action */
  onConfirm: () => void;
  /** Callback when user cancels or closes the dialog */
  onCancel: () => void;
  /** Optional confirm button text (default: "Confirm") */
  confirmText?: string;
  /** Optional cancel button text (default: "Cancel") */
  cancelText?: string;
  /** Whether this is a destructive operation (default: true) */
  isDestructive?: boolean;
  /** Whether the dialog is open (default: true) */
  isOpen?: boolean;
}

/**
 * Reusable confirmation dialog for destructive operations.
 *
 * Features:
 * - Visual warning styling for destructive actions (red/warning colors)
 * - Focus trap within the modal
 * - ESC key to cancel
 * - ARIA attributes for accessibility
 * - Required before delete/discard/cancel operations per §21
 *
 * @param props - Component props
 * @returns The confirmation dialog modal
 */
export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = true,
  isOpen = true,
}: ConfirmDialogProps): JSX.Element | null {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store the previously focused element when dialog opens
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus the confirm button after a short delay for screen readers
      const timer = setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else if (previousActiveElement.current) {
      // Restore focus when dialog closes
      previousActiveElement.current.focus();
    }
  }, [isOpen]);

  // Handle ESC key to cancel
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    },
    [onCancel]
  );

  // Handle click outside to cancel
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === overlayRef.current) {
        onCancel();
      }
    },
    [onCancel]
  );

  // Handle Tab key for focus trap
  const handleTabKey = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      // Get all focusable elements
      const focusableElements = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    },
    []
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      role="presentation"
      aria-hidden="false"
      onClick={handleOverlayClick}
      onKeyDown={(e) => {
        handleKeyDown(e);
        handleTabKey(e);
      }}
      style={styles.overlay}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        style={styles.dialog}
      >
        {/* Warning Icon */}
        {isDestructive && (
          <div style={styles.iconContainer} aria-hidden="true">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={styles.warningIcon}
            >
              <path
                d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.645 18.302 1.553 18.645 1.553 18.994C1.553 19.343 1.645 19.686 1.82 19.988C1.995 20.29 2.247 20.539 2.55 20.71C2.853 20.881 3.196 20.967 3.545 20.96H20.455C20.804 20.967 21.147 20.881 21.45 20.71C21.753 20.539 22.005 20.29 22.18 19.988C22.355 19.686 22.447 19.343 22.447 18.994C22.447 18.645 22.355 18.302 22.18 18L13.71 3.86C13.532 3.566 13.28 3.323 12.98 3.156C12.68 2.988 12.343 2.902 12 2.902C11.657 2.902 11.32 2.988 11.02 3.156C10.72 3.323 10.468 3.566 10.29 3.86Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {/* Title */}
        <h2
          id="confirm-dialog-title"
          style={{
            ...styles.title,
            ...(isDestructive ? styles.titleDestructive : {}),
          }}
        >
          {title}
        </h2>

        {/* Description */}
        <p id="confirm-dialog-description" style={styles.description}>
          {description}
        </p>

        {/* Button Group */}
        <div style={styles.buttonGroup}>
          <button
            type="button"
            onClick={onCancel}
            style={styles.cancelButton}
            aria-label={`${cancelText} and close dialog`}
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            style={{
              ...styles.confirmButton,
              ...(isDestructive ? styles.confirmButtonDestructive : {}),
            }}
            aria-label={`${confirmText} this action`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    backdropFilter: "blur(2px)",
  },
  dialog: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    padding: "2rem",
    maxWidth: "400px",
    width: "90%",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    textAlign: "center",
    animation: "dialogAppear 0.2s ease-out",
  },
  iconContainer: {
    marginBottom: "1rem",
  },
  warningIcon: {
    color: "#dc2626",
  },
  title: {
    margin: "0 0 0.75rem 0",
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#111827",
  },
  titleDestructive: {
    color: "#dc2626",
  },
  description: {
    margin: "0 0 1.5rem 0",
    fontSize: "0.875rem",
    color: "#6b7280",
    lineHeight: 1.5,
  },
  buttonGroup: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "center",
  },
  cancelButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  confirmButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  confirmButtonDestructive: {
    backgroundColor: "#dc2626",
  },
};
