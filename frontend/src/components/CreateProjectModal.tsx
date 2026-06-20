/**
 * CreateProjectModal component - modal for creating a new project.
 *
 * Provides a form with project name input and task type selector
 * (Binary Classification, Multiclass Classification, Regression).
 * On submit, calls POST /api/v1/projects to create the project.
 *
 * @module components/CreateProjectModal
 */
import { useState, useEffect, useRef, useCallback } from "react";
import type { Project } from "../stores/appStore";

/** Valid task types for project creation */
type TaskType = "binary_classification" | "multiclass_classification" | "regression";

export interface CreateProjectModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal is closed (cancel or backdrop click) */
  onClose: () => void;
  /** Callback when project is successfully created */
  onSuccess: (project: Project) => void;
  /** Function to create the project via API */
  onCreateProject: (name: string, taskType: TaskType) => Promise<Project>;
}

/**
 * Modal for creating a new project.
 *
 * Features:
 * - Project name text input with validation
 * - Task type selector (Binary Classification, Multiclass Classification, Regression)
 * - Form validation (required fields, non-empty name)
 * - Loading state during submission
 * - Error display on failure
 * - Focus trap and keyboard navigation (ESC to close, Tab to navigate)
 * - Accessible with ARIA attributes
 *
 * @param props - Component props
 * @returns The create project modal
 */
export function CreateProjectModal({
  isOpen,
  onClose,
  onSuccess,
  onCreateProject,
}: CreateProjectModalProps): JSX.Element | null {
  const [name, setName] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("binary_classification");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setTaskType("binary_classification");
      setError(null);
      setIsLoading(false);
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Focus name input after a short delay
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else if (previousActiveElement.current) {
      // Restore focus when modal closes
      previousActiveElement.current.focus();
    }
  }, [isOpen]);

  // Handle ESC key to close
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!isLoading) {
          onClose();
        }
      }
    },
    [onClose, isLoading]
  );

  // Handle click outside to close
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === overlayRef.current && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading]
  );

  // Handle Tab key for focus trap
  const handleTabKey = useCallback((event: React.KeyboardEvent) => {
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
  }, []);

  /**
   * Handle form submission.
   */
  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      // Validation
      const trimmedName = name.trim();
      if (!trimmedName) {
        setError("Project name is required");
        return;
      }

      if (trimmedName.length < 1 || trimmedName.length > 100) {
        setError("Project name must be between 1 and 100 characters");
        return;
      }

      setError(null);
      setIsLoading(true);

      try {
        const project = await onCreateProject(trimmedName, taskType);
        onSuccess(project);
        onClose();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create project";
        setError(errorMessage);
        setIsLoading(false);
      }
    },
    [name, taskType, onCreateProject, onSuccess, onClose]
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        style={styles.dialog}
      >
        {/* Header */}
        <div style={styles.header}>
          <h2 id="create-project-title" style={styles.title}>
            Create New Project
          </h2>
          <p style={styles.subtitle}>
            Set up a new machine learning project to get started
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Project Name Input */}
          <div style={styles.formGroup}>
            <label htmlFor="project-name" style={styles.label}>
              Project Name <span style={styles.required}>*</span>
            </label>
            <input
              ref={nameInputRef}
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
              disabled={isLoading}
              maxLength={100}
              style={styles.input}
              aria-required="true"
              aria-describedby={error ? "form-error" : undefined}
            />
          </div>

          {/* Task Type Selector */}
          <div style={styles.formGroup}>
            <label htmlFor="task-type" style={styles.label}>
              Task Type <span style={styles.required}>*</span>
            </label>
            <select
              id="task-type"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as TaskType)}
              disabled={isLoading}
              style={styles.select}
              aria-required="true"
            >
              <option value="binary_classification">Binary Classification</option>
              <option value="multiclass_classification">
                Multiclass Classification
              </option>
              <option value="regression">Regression</option>
            </select>
            <p style={styles.helperText}>
              Select the type of machine learning task for this project
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div id="form-error" role="alert" style={styles.errorContainer}>
              <span style={styles.errorText}>{error}</span>
            </div>
          )}

          {/* Button Group */}
          <div style={styles.buttonGroup}>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              style={{
                ...styles.cancelButton,
                ...(isLoading ? styles.buttonDisabled : {}),
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                ...styles.createButton,
                ...(isLoading ? styles.buttonDisabled : {}),
              }}
            >
              {isLoading ? (
                <span style={styles.buttonContent}>
                  <span style={styles.spinner} />
                  Creating...
                </span>
              ) : (
                "Create Project"
              )}
            </button>
          </div>
        </form>
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
    maxWidth: "480px",
    width: "90%",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    animation: "dialogAppear 0.2s ease-out",
  },
  header: {
    marginBottom: "1.5rem",
  },
  title: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#111827",
  },
  subtitle: {
    margin: 0,
    fontSize: "0.875rem",
    color: "#6b7280",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
  },
  required: {
    color: "#dc2626",
  },
  input: {
    padding: "0.625rem 0.875rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    color: "#111827",
    backgroundColor: "#ffffff",
    outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
  select: {
    padding: "0.625rem 0.875rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    color: "#111827",
    backgroundColor: "#ffffff",
    outline: "none",
    cursor: "pointer",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
  helperText: {
    margin: 0,
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  errorContainer: {
    padding: "0.75rem",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "6px",
  },
  errorText: {
    fontSize: "0.875rem",
    color: "#dc2626",
  },
  buttonGroup: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "flex-end",
    marginTop: "0.5rem",
  },
  cancelButton: {
    padding: "0.625rem 1.25rem",
    backgroundColor: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  createButton: {
    padding: "0.625rem 1.25rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  buttonContent: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  spinner: {
    display: "inline-block",
    width: "16px",
    height: "16px",
    border: "2px solid rgba(255, 255, 255, 0.3)",
    borderTop: "2px solid #ffffff",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
};
