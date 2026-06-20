/**
 * ProjectsDashboard screen - displays all projects and project creation.
 *
 * Shows a list of projects with quick stats, last updated timestamps,
 * and actions to create new projects or open existing ones.
 *
 * @module screens/ProjectsDashboard
 */
import type { Project } from "../stores/appStore";

interface ProjectsDashboardProps {
  /** List of projects to display */
  projects: Project[];
  /** Callback when a project is selected */
  onSelectProject: (projectId: string) => void;
  /** Callback to open project creation modal */
  onCreateProject: () => void;
}

/**
 * Projects dashboard screen component.
 *
 * @param props - Component props
 * @returns The projects dashboard
 */
export function ProjectsDashboard({
  projects,
  onSelectProject,
  onCreateProject,
}: ProjectsDashboardProps): JSX.Element {
  const hasProjects = projects.length > 0;

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
        <div style={styles.projectGrid}>
          {projects.map((project) => (
            <article
              key={project.id}
              style={styles.projectCard}
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
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>{project.name}</h3>
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
              </div>
              <div style={styles.cardStats}>
                <div style={styles.stat}>
                  <span style={styles.statValue}>{project.experimentCount}</span>
                  <span style={styles.statLabel}>Experiments</span>
                </div>
              </div>
              <p style={styles.cardUpdated}>
                Updated {formatRelativeTime(project.updatedAt)}
              </p>
            </article>
          ))}
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
  projectGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "1.5rem",
  },
  projectCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "1.5rem",
    cursor: "pointer",
    transition: "box-shadow 0.15s ease, border-color 0.15s ease",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1rem",
  },
  cardTitle: {
    margin: 0,
    fontSize: "1.125rem",
    fontWeight: 600,
    color: "#111827",
  },
  taskBadge: {
    padding: "0.25rem 0.5rem",
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
  cardStats: {
    display: "flex",
    gap: "1.5rem",
    marginBottom: "1rem",
  },
  stat: {
    display: "flex",
    flexDirection: "column",
  },
  statValue: {
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#111827",
  },
  statLabel: {
    fontSize: "0.75rem",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  cardUpdated: {
    margin: 0,
    fontSize: "0.75rem",
    color: "#9ca3af",
  },
};
