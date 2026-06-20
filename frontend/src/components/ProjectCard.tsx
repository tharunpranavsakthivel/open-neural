/**
 * ProjectCard component - displays a single project row in a table.
 *
 * Shows project name, task type badge, experiment count, and last-updated timestamp.
 * Includes action buttons for Open, Rename, and Delete operations.
 *
 * @module components/ProjectCard
 */
import { useState, useCallback } from "react";
import type { Project } from "../stores/appStore";
import { ConfirmDialog } from "./ConfirmDialog";

export interface ProjectCardProps {
  /** Project data to display */
  project: Project;
  /** Callback when the Open action is triggered */
  onOpen: (projectId: string) => void;
  /** Callback when the Rename action is triggered */
  onRename: (projectId: string, newName: string) => void;
  /** Callback when the Delete action is confirmed */
  onDelete: (projectId: string) => void;
}

/**
 * ProjectCard component displaying project information and action buttons.
 *
 * Renders a table row with project details and includes Open, Rename, and Delete
 * buttons. Delete requires confirmation via a confirmation dialog per the
 * Destructive Operation Protocol (INSTRUCTIONS.md §21).
 *
 * @param props - Component props
 * @returns The project card table row
 */
export function ProjectCard({
  project,
  onOpen,
  onRename,
  onDelete,
}: ProjectCardProps): JSX.Element {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(project.name);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  /**
   * Handle opening the project.
   */
  const handleOpen = useCallback(() => {
    onOpen(project.id);
  }, [onOpen, project.id]);

  /**
   * Handle initiating rename mode.
   */
  const handleStartRename = useCallback(() => {
    setNewName(project.name);
    setIsRenaming(true);
  }, [project.name]);

  /**
   * Handle canceling rename.
   */
  const handleCancelRename = useCallback(() => {
    setIsRenaming(false);
    setNewName(project.name);
  }, [project.name]);

  /**
   * Handle confirming rename.
   */
  const handleConfirmRename = useCallback(() => {
    const trimmedName = newName.trim();
    if (trimmedName && trimmedName !== project.name) {
      onRename(project.id, trimmedName);
    }
    setIsRenaming(false);
  }, [newName, onRename, project.id, project.name]);

  /**
   * Handle key press in rename input.
   */
  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleConfirmRename();
      } else if (e.key === "Escape") {
        handleCancelRename();
      }
    },
    [handleConfirmRename, handleCancelRename]
  );

  /**
   * Handle opening delete confirmation dialog.
   */
  const handleStartDelete = useCallback(() => {
    setIsDeleteDialogOpen(true);
  }, []);

  /**
   * Handle canceling delete.
   */
  const handleCancelDelete = useCallback(() => {
    setIsDeleteDialogOpen(false);
  }, []);

  /**
   * Handle confirming delete.
   */
  const handleConfirmDelete = useCallback(() => {
    onDelete(project.id);
    setIsDeleteDialogOpen(false);
  }, [onDelete, project.id]);

  return (
    <>
      <tr style={styles.tableRow}>
        {/* Name Cell */}
        <td style={styles.tableCell}>
          {isRenaming ? (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={handleConfirmRename}
              autoFocus
              style={styles.renameInput}
              aria-label="Rename project"
            />
          ) : (
            <span style={styles.projectName}>{project.name}</span>
          )}
        </td>

        {/* Task Type Cell */}
        <td style={styles.tableCell}>
          <span
            style={{
              ...styles.taskBadge,
              ...(project.taskType === "classification"
                ? styles.badgeClassification
                : styles.badgeRegression),
            }}
          >
            {project.taskType}
          </span>
        </td>

        {/* Experiment Count Cell */}
        <td style={styles.tableCell}>
          <span style={styles.experimentCount}>{project.experimentCount}</span>
        </td>

        {/* Last Updated Cell */}
        <td style={styles.tableCell}>
          <span style={styles.lastUpdated}>
            {formatRelativeTime(project.updatedAt)}
          </span>
        </td>

        {/* Actions Cell */}
        <td style={styles.actionsCell}>
          <div style={styles.actionButtons}>
            <button
              onClick={handleOpen}
              style={styles.openButton}
              aria-label={`Open project ${project.name}`}
            >
              Open
            </button>
            <button
              onClick={handleStartRename}
              style={styles.renameButton}
              aria-label={`Rename project ${project.name}`}
            >
              Rename
            </button>
            <button
              onClick={handleStartDelete}
              style={styles.deleteButton}
              aria-label={`Delete project ${project.name}`}
            >
              Delete
            </button>
          </div>
        </td>
      </tr>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Delete Project"
        description="Deleting this project will permanently remove all experiments, snapshots, and exports. This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}

/**
 * Format a timestamp as relative time.
 *
 * @param timestamp - ISO timestamp string
 * @returns Relative time string (e.g., "2 hours ago")
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const styles: Record<string, React.CSSProperties> = {
  tableRow: {
    borderBottom: "1px solid #e5e7eb",
    transition: "background-color 0.15s ease",
  },
  tableCell: {
    padding: "1rem 1.5rem",
    verticalAlign: "middle",
  },
  projectName: {
    fontWeight: 500,
    color: "#111827",
    fontSize: "0.875rem",
  },
  renameInput: {
    padding: "0.375rem 0.75rem",
    border: "1px solid #2563eb",
    borderRadius: "4px",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#111827",
    width: "100%",
    maxWidth: "200px",
    outline: "none",
  },
  taskBadge: {
    display: "inline-block",
    padding: "0.25rem 0.75rem",
    borderRadius: "9999px",
    fontSize: "0.75rem",
    fontWeight: 500,
    textTransform: "capitalize",
  },
  badgeClassification: {
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
  },
  badgeRegression: {
    backgroundColor: "#dcfce7",
    color: "#15803d",
  },
  experimentCount: {
    fontWeight: 500,
    color: "#111827",
    fontSize: "0.875rem",
  },
  lastUpdated: {
    color: "#6b7280",
    fontSize: "0.875rem",
  },
  actionsCell: {
    padding: "1rem 1.5rem",
    verticalAlign: "middle",
  },
  actionButtons: {
    display: "flex",
    gap: "0.5rem",
  },
  openButton: {
    padding: "0.375rem 0.75rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  renameButton: {
    padding: "0.375rem 0.75rem",
    backgroundColor: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  deleteButton: {
    padding: "0.375rem 0.75rem",
    backgroundColor: "#fef2f2",
    color: "#dc2626",
    border: "1px solid #fecaca",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
};
