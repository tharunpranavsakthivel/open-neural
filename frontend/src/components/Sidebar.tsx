/**
 * Sidebar component - left navigation for the OpenNeural application.
 *
 * Displays the wizard step navigation, current project info, and actions
 * to navigate between steps or return to the projects dashboard.
 *
 * @module components/Sidebar
 */
import type { WizardStep } from "../stores/appStore";

interface SidebarProps {
  /** Currently active wizard step */
  currentStep: WizardStep;
  /** Currently selected project ID, null if on dashboard */
  currentProjectId: string | null;
  /** Callback to navigate to a step */
  onStepClick: (step: WizardStep) => void;
  /** Callback to return to projects dashboard */
  onGoToProjects: () => void;
  /** Project name if a project is selected */
  projectName?: string;
}

/** Wizard step configuration */
const WIZARD_STEPS: { id: WizardStep; label: string; number: number }[] = [
  { id: "dataset", label: "Dataset", number: 1 },
  { id: "preprocessing", label: "Preprocessing", number: 2 },
  { id: "model", label: "Model", number: 3 },
  { id: "training", label: "Training", number: 4 },
  { id: "evaluation", label: "Evaluation", number: 5 },
  { id: "leaderboard", label: "Leaderboard", number: 6 },
  { id: "export", label: "Export", number: 7 },
];

/**
 * Sidebar navigation component.
 *
 * @param props - Component props
 * @returns The sidebar component
 */
export function Sidebar({
  currentStep,
  currentProjectId,
  onStepClick,
  onGoToProjects,
  projectName,
}: SidebarProps): JSX.Element {
  const isOnDashboard = currentStep === "projects" || currentProjectId === null;

  return (
    <aside aria-label="Navigation sidebar" style={styles.sidebar}>
      <div style={styles.header}>
        <h1 style={styles.title}>OpenNeural</h1>
        <p style={styles.version}>v0.1.0</p>
      </div>

      <nav aria-label="Wizard steps" style={styles.nav}>
        {isOnDashboard ? (
          <div style={styles.dashboardSection}>
            <h2 style={styles.sectionTitle}>Projects</h2>
            <p style={styles.sectionDescription}>
              Select or create a project to begin your ML workflow.
            </p>
          </div>
        ) : (
          <>
            <div style={styles.projectSection}>
              <button
                onClick={onGoToProjects}
                style={styles.backButton}
                aria-label="Back to projects"
              >
                ← Back to Projects
              </button>
              {projectName && (
                <p style={styles.projectName} title={projectName}>
                  {projectName}
                </p>
              )}
            </div>

            <ol style={styles.stepList}>
              {WIZARD_STEPS.map((step) => {
                const isActive = currentStep === step.id;
                const isDisabled = false; // All steps clickable for MVP

                return (
                  <li key={step.id} style={styles.stepItem}>
                    <button
                      onClick={() => onStepClick(step.id)}
                      disabled={isDisabled}
                      aria-current={isActive ? "step" : undefined}
                      style={{
                        ...styles.stepButton,
                        ...(isActive ? styles.stepButtonActive : {}),
                        ...(isDisabled ? styles.stepButtonDisabled : {}),
                      }}
                    >
                      <span
                        style={{
                          ...styles.stepNumber,
                          ...(isActive ? styles.stepNumberActive : {}),
                        }}
                      >
                        {step.number}
                      </span>
                      <span style={styles.stepLabel}>{step.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </nav>

      <footer style={styles.footer}>
        <p style={styles.footerText}>Local ML Experimentation</p>
      </footer>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: "260px",
    minHeight: "100vh",
    backgroundColor: "#ffffff",
    borderRight: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  header: {
    padding: "1.5rem",
    borderBottom: "1px solid #e5e7eb",
  },
  title: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#111827",
  },
  version: {
    margin: "0.25rem 0 0 0",
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  nav: {
    flex: 1,
    padding: "1rem 0",
    overflowY: "auto",
  },
  dashboardSection: {
    padding: "1rem 1.5rem",
  },
  sectionTitle: {
    margin: "0 0 0.5rem 0",
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  sectionDescription: {
    margin: 0,
    fontSize: "0.875rem",
    color: "#6b7280",
    lineHeight: 1.5,
  },
  projectSection: {
    padding: "0 1.5rem 1rem 1.5rem",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: "1rem",
  },
  backButton: {
    padding: "0.5rem 0",
    backgroundColor: "transparent",
    border: "none",
    color: "#2563eb",
    fontSize: "0.875rem",
    cursor: "pointer",
    textAlign: "left",
  },
  projectName: {
    margin: "0.5rem 0 0 0",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#111827",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  stepList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  stepItem: {
    margin: 0,
  },
  stepButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.75rem 1.5rem",
    backgroundColor: "transparent",
    border: "none",
    color: "#374151",
    fontSize: "0.875rem",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  stepButtonActive: {
    backgroundColor: "#eff6ff",
    color: "#2563eb",
  },
  stepButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  stepNumber: {
    width: "24px",
    height: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    backgroundColor: "#e5e7eb",
    color: "#374151",
    fontSize: "0.75rem",
    fontWeight: 600,
  },
  stepNumberActive: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
  },
  stepLabel: {
    flex: 1,
    textAlign: "left",
  },
  footer: {
    padding: "1rem 1.5rem",
    borderTop: "1px solid #e5e7eb",
  },
  footerText: {
    margin: 0,
    fontSize: "0.75rem",
    color: "#9ca3af",
    textAlign: "center",
  },
};
