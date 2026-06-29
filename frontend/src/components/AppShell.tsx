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
import { TrainingProgress } from "../screens/TrainingProgress";
import { Evaluation } from "../screens/Evaluation";
import { Leaderboard } from "../screens/Leaderboard";
import { Export } from "../screens/Export";
import { Settings } from "../screens/Settings";

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
    currentExperimentId,
    projects,
    setCurrentStep,
    setCurrentExperimentId,
    selectProject,
    goToProjects,
  } = useAppStore();

  const currentProject = projects.find((p) => p.id === currentProjectId);

  /**
   * Handle training complete - navigate to evaluation step.
   */
  const handleTrainingComplete = (): void => {
    setCurrentStep("evaluation");
  };

  /**
   * Handle training cancelled - navigate back to model selection.
   */
  const handleTrainingCancelled = (): void => {
    // Clear the current experiment
    setCurrentExperimentId(null);
    setCurrentStep("model");
  };

  /**
   * Handle start training from ModelSelection - store experiment ID and go to training.
   */
  const handleStartTraining = (experimentId: string): void => {
    setCurrentExperimentId(experimentId);
    setCurrentStep("training");
  };

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
      preprocessing: (
        <PreprocessingPipeline
          projectId={currentProjectId}
          onComplete={() => setCurrentStep("model")}
        />
      ),
      model: (
        <ModelSelection
          projectId={currentProjectId}
          pipelineId="mock-pipeline-id"
          onStartTraining={handleStartTraining}
        />
      ),
      training: currentExperimentId ? (
        <TrainingProgress
          experimentId={currentExperimentId}
          onTrainingComplete={handleTrainingComplete}
          onTrainingCancelled={handleTrainingCancelled}
          onReturnToModelSelection={handleTrainingCancelled}
        />
      ) : (
        <div style={styles.noExperimentMessage}>
          <p>No active experiment. Please configure models and start training.</p>
          <button
            onClick={() => setCurrentStep("model")}
            style={styles.returnButton}
          >
            Return to Model Selection
          </button>
        </div>
      ),
      evaluation: <Evaluation projectId={currentProjectId} />,
      leaderboard: <Leaderboard projectId={currentProjectId} />,
      export: <Export projectId={currentProjectId} />,
      settings: <Settings />,
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
  noExperimentMessage: {
    padding: "2rem",
    textAlign: "center" as const,
    color: "#6b7280",
  },
  returnButton: {
    marginTop: "1rem",
    padding: "0.75rem 1.5rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
  },
};
