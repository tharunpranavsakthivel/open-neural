/**
 * ProjectsDashboard screen - displays all projects and project creation.
 *
 * Shows a stats bar with aggregate metrics, a list of projects in a table format
 * with columns for name, task type, experiment count, and last updated timestamp.
 * On mount, fetches projects and dashboard stats from the backend API.
 *
 * @module screens/ProjectsDashboard
 */
import { useEffect, useState } from "react";
import type { Project } from "../stores/appStore";
import type { DashboardStats } from "../utils/api";
import { fetchProjects, fetchDashboardStats } from "../utils/api";

interface ProjectsDashboardProps {
  /** Callback when a project is selected */
  onSelectProject: (projectId: string) => void;
  /** Callback to open project creation modal */
  onCreateProject: () => void;
}

/**
 * Projects dashboard screen component.
 *
 * Fetches projects and dashboard statistics on mount via the backend API,
 * displays a stats bar with aggregate metrics, and renders a table of
 * all projects with sortable columns.
 *
 * @param props - Component props
 * @returns The projects dashboard
 */
export function ProjectsDashboard({
  onSelectProject,
  onCreateProject,
}: ProjectsDashboardProps): JSX.Element {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalExperiments: 0,
    totalExports: 0,
    totalSnapshots: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch projects and dashboard stats on component mount.
   */
  useEffect(() => {
    /**
     * Load data from the backend APIs.
     */
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch both projects and stats in parallel
        const [projectsData, statsData] = await Promise.all([
          fetchProjects(),
          fetchDashboardStats(),
        ]);

        setProjects(projectsData);
        setStats(statsData);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load dashboard data";
        setError(errorMessage);
        console.error("Dashboard data fetch failed:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const hasProjects = projects.length > 0;

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner} aria-label="Loading" />
          <p style={styles.loadingText}>Loading projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <h2 style={styles.errorTitle}>Failed to load projects</h2>
          <p style={styles.errorMessage}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={styles.retryButton}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Projects</h1>
          <p style={styles.subtitle}>
            Manage your machine learning experiments and datasets
          </p>
        </div>
        <button onClick={onCreateProject} style={styles.createButton}>
          + New Project
        </button>
      </header>

      {/* Stats Bar */}
      <div style={styles.statsBar}>
        <div style={styles.statCard}>
          <span style={styles.statCardValue}>{stats.totalExperiments}</span>
          <span style={styles.statCardLabel}>Total Experiments</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statCardValue}>{stats.totalExports}</span>
          <span style={styles.statCardLabel}>Total Exports</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statCardValue}>{stats.totalSnapshots}</span>
          <span style={styles.statCardLabel}>Total Snapshots</span>
        </div>
      </div>

      {!hasProjects ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📁</div>
          <h2 style={styles.emptyTitle}>No projects yet</h2>
          <p style={styles.emptyDescription}>
            Create your first project to start building machine learning models.
          </p>
          <button onClick={onCreateProject} style={styles.emptyButton}>
            Create Project
          </button>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.tableHeader}>Name</th>
                <th style={styles.tableHeader}>Task Type</th>
                <th style={styles.tableHeader}>Experiments</th>
                <th style={styles.tableHeader}>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  style={styles.tableRow}
                  onClick={() => onSelectProject(project.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onSelectProject(project.id);
                    }
                  }}
                  aria-label={`Open project ${project.name}`}
                >
                  <td style={styles.tableCell}>
                    <span style={styles.projectName}>{project.name}</span>
                  </td>
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
                  <td style={styles.tableCell}>
                    <span style={styles.experimentCount}>
                      {project.experimentCount}
                    </span>
                  </td>
                  <td style={styles.tableCell}>
                    <span style={styles.lastUpdated}>
                      {formatRelativeTime(project.updatedAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
  container: {
    padding: "2rem",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "4rem 2rem",
  },
  loadingSpinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #e5e7eb",
    borderTop: "3px solid #2563eb",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    marginTop: "1rem",
    color: "#6b7280",
    fontSize: "0.875rem",
  },
  errorContainer: {
    textAlign: "center",
    padding: "4rem 2rem",
    backgroundColor: "#fef2f2",
    borderRadius: "8px",
    border: "1px solid #fecaca",
  },
  errorTitle: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#dc2626",
  },
  errorMessage: {
    margin: "0 0 1.5rem 0",
    color: "#7f1d1d",
    fontSize: "0.875rem",
  },
  retryButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#dc2626",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
  createButton: {
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
  statsBar: {
    display: "flex",
    gap: "1.5rem",
    marginBottom: "2rem",
    padding: "1.5rem",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
  },
  statCard: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
  statCardValue: {
    fontSize: "2rem",
    fontWeight: 700,
    color: "#111827",
  },
  statCardLabel: {
    fontSize: "0.875rem",
    color: "#6b7280",
    marginTop: "0.25rem",
  },
  emptyState: {
    textAlign: "center",
    padding: "4rem 2rem",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    border: "2px dashed #e5e7eb",
  },
  emptyIcon: {
    fontSize: "3rem",
    marginBottom: "1rem",
  },
  emptyTitle: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#374151",
  },
  emptyDescription: {
    margin: "0 0 1.5rem 0",
    color: "#6b7280",
    fontSize: "0.875rem",
  },
  emptyButton: {
    padding: "0.75rem 2rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  tableContainer: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHeader: {
    padding: "1rem 1.5rem",
    textAlign: "left",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    backgroundColor: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
  },
  tableRow: {
    cursor: "pointer",
    transition: "background-color 0.15s ease",
    borderBottom: "1px solid #e5e7eb",
  },
  tableCell: {
    padding: "1rem 1.5rem",
  },
  projectName: {
    fontWeight: 500,
    color: "#111827",
    fontSize: "0.875rem",
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
};
