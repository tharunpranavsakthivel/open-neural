/**
 * Evaluation screen - Step 5: Evaluation dashboard and metrics.
 *
 * Displays model evaluation metrics, confusion matrix, and subgroup analysis.
 * This is a wrapper component that retrieves the current experiment ID from the
 * app store and renders the EvaluationDashboard component.
 *
 * @module screens/Evaluation
 */
import { useAppStore } from "../stores/appStore";
import { EvaluationDashboard } from "./EvaluationDashboard";

/**
 * EvaluationProps interface.
 */
interface EvaluationProps {
  /** Currently selected project ID */
  projectId: string;
}

/**
 * Evaluation wizard step component.
 *
 * Retrieves the current experiment ID from the app store and renders the
 * EvaluationDashboard component. If no experiment is selected, displays
 * a message prompting the user to complete training first.
 *
 * @param props - Component props (projectId is passed but experimentId comes from store)
 * @returns The evaluation screen
 */
export function Evaluation({
  projectId: _projectId,
}: EvaluationProps): JSX.Element {
  const { currentExperimentId } = useAppStore();

  // If no experiment is selected, show a placeholder
  if (!currentExperimentId) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Evaluation</h1>
          <p style={styles.description}>
            Review model performance metrics and analysis.
          </p>
        </header>

        <div style={styles.placeholderCard}>
          <h2 style={styles.placeholderTitle}>No Evaluation Available</h2>
          <p style={styles.placeholderText}>
            Please complete training first to view evaluation results.
          </p>
          <p style={styles.placeholderHint}>
            Navigate to the Model Selection step and start training to generate
            evaluation metrics.
          </p>
        </div>
      </div>
    );
  }

  // Render the evaluation dashboard with the current experiment
  return <EvaluationDashboard experimentId={currentExperimentId} />;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "2rem",
  },
  header: {
    marginBottom: "2rem",
  },
  title: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#111827",
  },
  description: {
    margin: 0,
    color: "#6b7280",
    fontSize: "0.875rem",
  },
  placeholderCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "3rem",
    textAlign: "center",
  },
  placeholderTitle: {
    margin: "0 0 1rem 0",
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#374151",
  },
  placeholderText: {
    margin: "0 0 0.5rem 0",
    fontSize: "1rem",
    color: "#6b7280",
  },
  placeholderHint: {
    margin: 0,
    fontSize: "0.875rem",
    color: "#9ca3af",
  },
};
