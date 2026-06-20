/**
 * AppShell component - main application layout after authentication.
 *
 * Provides the primary application shell with a left sidebar for navigation
 * and a main content area that renders either the projects dashboard or the
 * active wizard step based on current state.
 *
 * @module components/AppShell
 */
import { useAppStore } from "../stores/appStore";
import type { WizardStep } from "../stores/appStore";
import { Sidebar } from "./Sidebar";
import { ProjectsDashboard } from "../screens/ProjectsDashboard";
import { DatasetImport } from "../screens/DatasetImport";
import { PreprocessingPipeline } from "../screens/PreprocessingPipeline";
import { ModelSelection } from "../screens/ModelSelection";
import { Training } from "../screens/Training";
import { Evaluation } from "../screens/Evaluation";
import { Leaderboard } from "../screens/Leaderboard";
import { Export } from "../screens/Export";

/**
 * Main application shell component.
 *
 * Renders the Sidebar on the left and the main content area on the right.
 * The content area displays either the projects dashboard or the active
 * wizard step based on the current navigation state.
 *
 * @returns The application shell with sidebar and content area
 */
export function AppShell(): JSX.Element {
  const {
    currentStep,
    currentProjectId,
    projects,
    setCurrentStep,
    selectProject,
    goToProjects,
    openProjectModal,
  } = useAppStore();

  const currentProject = projects.find((p) => p.id === currentProjectId);

  /**
   * Render the active content based on current step.
   *
   * @returns The appropriate screen component
   */
  function renderContent(): JSX.Element {
    if (currentStep === "projects" || !currentProjectId) {
      return (
        <ProjectsDashboard
          onSelectProject={selectProject}
          onCreateProject={openProjectModal}
        />
      );
    }

    const stepComponents: Record<WizardStep, JSX.Element | null> = {
      projects: null,
      dataset: (
        <DatasetImport
          projectId={currentProjectId}
          onComplete={() => setCurrentStep("preprocessing")}
        />
      ),
      preprocessing: <PreprocessingPipeline projectId={currentProjectId} />,
      model: <ModelSelection projectId={currentProjectId} />,
      training: <Training projectId={currentProjectId} />,
      evaluation: <Evaluation projectId={currentProjectId} />,
      leaderboard: <Leaderboard projectId={currentProjectId} />,
      export: <Export projectId={currentProjectId} />,
    };

    return stepComponents[currentStep] || <div>Unknown step</div>;
  }

  return (
    <div style={styles.container}>
      <Sidebar
        currentStep={currentStep}
        currentProjectId={currentProjectId}
        onStepClick={setCurrentStep}
        onGoToProjects={goToProjects}
        projectName={currentProject?.name}
      />

      <main aria-label="Application content" style={styles.main}>
        {renderContent()}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
    backgroundColor: "#f9fafb",
  },
  main: {
    flex: 1,
    overflowY: "auto",
    minHeight: "100vh",
  },
};
