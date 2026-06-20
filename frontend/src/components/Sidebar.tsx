/**
 * Sidebar component - left navigation for the OpenNeural application.
 *
 * Displays the OpenNeural logo, app version (fetched from API), and step-by-step
 * navigation. Supports keyboard navigation (arrow keys, Enter) and highlights
 * the active step. Allows navigation to previously completed steps.
 *
 * @module components/Sidebar
 */
import { useEffect, useState, useRef, useCallback } from "react";
import type { WizardStep } from "../stores/appStore";
import { useAppStore } from "../stores/appStore";

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

/** Step configuration for navigation */
const NAVIGATION_STEPS: { id: WizardStep; label: string; number: number }[] = [
  { id: "projects", label: "Projects", number: 0 },
  { id: "dataset", label: "Import", number: 1 },
  { id: "preprocessing", label: "Pipeline", number: 2 },
  { id: "model", label: "Model", number: 3 },
  { id: "training", label: "Train", number: 4 },
  { id: "evaluation", label: "Evaluate", number: 5 },
  { id: "leaderboard", label: "Leaderboard", number: 6 },
  { id: "export", label: "Export", number: 7 },
];

/**
 * Sidebar navigation component.
 *
 * Features:
 * - Displays OpenNeural logo and app version from API
 * - Step-by-step navigation with active step highlighting
 * - Keyboard navigation support (arrow keys, Enter)
 * - Allows navigation to any previously completed step
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
  const { backendPort } = useAppStore();
  const [appVersion, setAppVersion] = useState<string>("v0.1.0");
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const navRef = useRef<HTMLElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Fetch app version from API
  useEffect(() => {
    async function fetchVersion() {
      if (!backendPort) return;

      try {
        const response = await fetch(
          `http://127.0.0.1:${backendPort}/api/v1/health`,
          {
            headers: {
              "X-OpenNeural-Secret": "dev-secret", // Development mode
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          if (data.version) {
            setAppVersion(`v${data.version}`);
          }
        }
      } catch {
        // Fallback to default version if API is not available
        console.log("Could not fetch version from API, using default");
      }
    }

    fetchVersion();
  }, [backendPort]);

  // Get current step index
  const currentStepIndex = NAVIGATION_STEPS.findIndex(
    (step) => step.id === currentStep
  );

  // Determine if a step is accessible (current or before current)
  const isStepAccessible = useCallback(
    (stepIndex: number): boolean => {
      // Projects is always accessible
      if (stepIndex === 0) return true;
      // If no project selected, only Projects is accessible
      if (!currentProjectId) return false;
      // Allow navigation to current step and any previous steps
      return stepIndex <= currentStepIndex;
    },
    [currentProjectId, currentStepIndex]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const accessibleSteps = NAVIGATION_STEPS.map((_, i) => i).filter((i) =>
        isStepAccessible(i)
      );
      const currentAccessibleIndex = accessibleSteps.indexOf(focusedIndex);

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (currentAccessibleIndex < accessibleSteps.length - 1) {
            const nextAccessible = accessibleSteps[currentAccessibleIndex + 1];
            if (nextAccessible !== undefined) {
              setFocusedIndex(nextAccessible);
              buttonRefs.current[nextAccessible]?.focus();
            }
          }
          break;

        case "ArrowUp":
          event.preventDefault();
          if (currentAccessibleIndex > 0) {
            const prevAccessible = accessibleSteps[currentAccessibleIndex - 1];
            if (prevAccessible !== undefined) {
              setFocusedIndex(prevAccessible);
              buttonRefs.current[prevAccessible]?.focus();
            }
          }
          break;

        case "Enter":
        case " ":
          event.preventDefault();
          if (
            focusedIndex >= 0 &&
            focusedIndex < NAVIGATION_STEPS.length &&
            isStepAccessible(focusedIndex)
          ) {
            const navStep = NAVIGATION_STEPS[focusedIndex];
            if (navStep !== undefined) {
              if (navStep.id === "projects") {
                onGoToProjects();
              } else {
                onStepClick(navStep.id);
              }
            }
          }
          break;

        case "Home":
          event.preventDefault();
          if (accessibleSteps.length > 0) {
            const firstAccessible = accessibleSteps[0];
            if (firstAccessible !== undefined) {
              setFocusedIndex(firstAccessible);
              buttonRefs.current[firstAccessible]?.focus();
            }
          }
          break;

        case "End":
          event.preventDefault();
          if (accessibleSteps.length > 0) {
            const lastAccessible = accessibleSteps[accessibleSteps.length - 1];
            if (lastAccessible !== undefined) {
              setFocusedIndex(lastAccessible);
              buttonRefs.current[lastAccessible]?.focus();
            }
          }
          break;
      }
    },
    [focusedIndex, isStepAccessible, onGoToProjects, onStepClick]
  );

  // Handle step click
  const handleStepClick = (stepId: WizardStep, stepIndex: number) => {
    if (!isStepAccessible(stepIndex)) return;

    if (stepId === "projects") {
      onGoToProjects();
    } else {
      onStepClick(stepId);
    }
  };

  // Set initial focus to current step
  useEffect(() => {
    if (currentStepIndex >= 0) {
      setFocusedIndex(currentStepIndex);
    }
  }, [currentStepIndex]);

  return (
    <aside
      aria-label="Navigation sidebar"
      style={styles.sidebar}
      onKeyDown={handleKeyDown}
    >
      {/* Header with Logo and Version */}
      <div style={styles.header}>
        <div style={styles.logoContainer}>
          <div aria-hidden="true" style={styles.logo}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="32" height="32" rx="8" fill="#2563eb" />
              <path
                d="M16 8C11.58 8 8 11.58 8 16s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"
                fill="white"
              />
              <circle cx="16" cy="16" r="3" fill="white" />
            </svg>
          </div>
          <div>
            <h1 style={styles.title}>OpenNeural</h1>
            <p style={styles.version} aria-label={`Application version ${appVersion}`}>
              {appVersion}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav
        ref={navRef}
        aria-label="Main navigation"
        style={styles.nav}
        role="menubar"
      >
        <ol style={styles.stepList} role="menu">
          {NAVIGATION_STEPS.map((step, index) => {
            const isActive = currentStep === step.id;
            const isAccessible = isStepAccessible(index);
            const isProjects = step.id === "projects";

            return (
              <li key={step.id} style={styles.stepItem} role="none">
                <button
                  ref={(el) => {
                    buttonRefs.current[index] = el;
                  }}
                  onClick={() => handleStepClick(step.id, index)}
                  disabled={!isAccessible}
                  aria-current={isActive ? "page" : undefined}
                  aria-disabled={!isAccessible}
                  role="menuitem"
                  tabIndex={isActive ? 0 : -1}
                  onFocus={() => setFocusedIndex(index)}
                  style={{
                    ...styles.stepButton,
                    ...(isActive ? styles.stepButtonActive : {}),
                    ...(isAccessible && !isActive ? styles.stepButtonHover : {}),
                    ...(!isAccessible ? styles.stepButtonDisabled : {}),
                    ...(isProjects && !isActive ? styles.projectsButton : {}),
                  }}
                >
                  <span
                    style={{
                      ...styles.stepNumber,
                      ...(isActive ? styles.stepNumberActive : {}),
                      ...(!isAccessible ? styles.stepNumberDisabled : {}),
                    }}
                    aria-hidden="true"
                  >
                    {step.number}
                  </span>
                  <span style={styles.stepLabel}>{step.label}</span>
                  {isActive && (
                    <span style={styles.activeIndicator} aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Project Info (when in a project) */}
      {currentProjectId && projectName && (
        <div style={styles.projectInfo}>
          <p style={styles.projectLabel}>Current Project</p>
          <p style={styles.projectName} title={projectName}>
            {projectName}
          </p>
        </div>
      )}

      {/* Footer */}
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
  logoContainer: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  logo: {
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: "1.125rem",
    fontWeight: 600,
    color: "#111827",
    lineHeight: 1.2,
  },
  version: {
    margin: "0.125rem 0 0 0",
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  nav: {
    flex: 1,
    padding: "1rem 0",
    overflowY: "auto",
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
    padding: "0.625rem 1.5rem",
    backgroundColor: "transparent",
    border: "none",
    color: "#374151",
    fontSize: "0.875rem",
    cursor: "pointer",
    transition: "all 0.15s ease",
    position: "relative",
    textAlign: "left",
  },
  stepButtonHover: {
    backgroundColor: "#f9fafb",
  },
  stepButtonActive: {
    backgroundColor: "#eff6ff",
    color: "#2563eb",
    fontWeight: 500,
  },
  stepButtonDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  projectsButton: {
    borderBottom: "1px solid #e5e7eb",
    marginBottom: "0.5rem",
    paddingBottom: "0.75rem",
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
    flexShrink: 0,
  },
  stepNumberActive: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
  },
  stepNumberDisabled: {
    backgroundColor: "#f3f4f6",
    color: "#9ca3af",
  },
  stepLabel: {
    flex: 1,
    textAlign: "left",
  },
  activeIndicator: {
    width: "3px",
    height: "20px",
    backgroundColor: "#2563eb",
    borderRadius: "2px",
    marginLeft: "auto",
  },
  projectInfo: {
    padding: "1rem 1.5rem",
    borderTop: "1px solid #e5e7eb",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
  },
  projectLabel: {
    margin: "0 0 0.25rem 0",
    fontSize: "0.75rem",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  projectName: {
    margin: 0,
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#111827",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  footer: {
    padding: "1rem 1.5rem",
    borderTop: "1px solid #e5e7eb",
    marginTop: "auto",
  },
  footerText: {
    margin: 0,
    fontSize: "0.75rem",
    color: "#9ca3af",
    textAlign: "center",
  },
};
