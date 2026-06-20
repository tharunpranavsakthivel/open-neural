/**
 * ModelSelection screen - Step 3: Model selection and AutoML configuration.
 *
 * Allows users to select candidate models and configure AutoML parameters.
 *
 * @module screens/ModelSelection
 */
interface ModelSelectionProps {
  /** Currently selected project ID */
  projectId: string;
}

/**
 * Model selection wizard step component.
 *
 * @param props - Component props
 * @returns The model selection screen
 */
export function ModelSelection({ projectId: _projectId }: ModelSelectionProps): JSX.Element {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Model Selection</h1>
        <p style={styles.description}>
          Choose candidate models and configure AutoML settings.
        </p>
      </header>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>AutoML Mode</h2>
        <label style={styles.checkboxLabel}>
          <input type="checkbox" defaultChecked style={styles.checkbox} />
          <span>Enable AutoML (automatic model selection and hyperparameter tuning)</span>
        </label>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Candidate Models</h2>
        <div style={styles.modelGrid}>
          {[
            "Logistic Regression",
            "Random Forest",
            "Gradient Boosting",
            "XGBoost",
            "SVM",
            "k-NN",
          ].map((model) => (
            <label key={model} style={styles.modelCard}>
              <input type="checkbox" style={styles.checkbox} />
              <span style={styles.modelName}>{model}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Optimization Settings</h2>
        <div style={styles.settingsGrid}>
          <div style={styles.setting}>
            <label style={styles.settingLabel}>Optimization Metric</label>
            <select style={styles.select}>
              <option value="f1">F1 Score</option>
              <option value="auc_roc">AUC-ROC</option>
              <option value="precision">Precision</option>
              <option value="recall">Recall</option>
            </select>
          </div>
          <div style={styles.setting}>
            <label style={styles.settingLabel}>Max Trials</label>
            <input type="number" defaultValue={25} style={styles.input} />
          </div>
          <div style={styles.setting}>
            <label style={styles.settingLabel}>CV Folds</label>
            <input type="number" defaultValue={5} style={styles.input} />
          </div>
          <div style={styles.setting}>
            <label style={styles.settingLabel}>Time Budget (min)</label>
            <input type="number" defaultValue={8} style={styles.input} />
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "800px",
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
  section: {
    marginBottom: "2rem",
    padding: "1.5rem",
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  sectionTitle: {
    margin: "0 0 1rem 0",
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.875rem",
    color: "#374151",
    cursor: "pointer",
  },
  checkbox: {
    width: "1rem",
    height: "1rem",
    cursor: "pointer",
  },
  modelGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "0.75rem",
  },
  modelCard: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.75rem",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    cursor: "pointer",
  },
  modelName: {
    fontSize: "0.875rem",
    color: "#374151",
  },
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "1rem",
  },
  setting: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  settingLabel: {
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "#374151",
  },
  select: {
    padding: "0.5rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    backgroundColor: "#ffffff",
  },
  input: {
    padding: "0.5rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    width: "100%",
    boxSizing: "border-box",
  },
};
