/**
 * AppShell component - main application layout after authentication.
 *
 * Provides the primary application shell with navigation and content area
 * for the OpenNeural step wizard workflow.
 *
 * @module components/AppShell
 */

/**
 * Main application shell component.
 *
 * @returns The application shell with navigation and content area
 */
export function AppShell(): JSX.Element {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>OpenNeural</h1>
        <nav aria-label="Main navigation" style={styles.nav}>
          <ol style={styles.stepList}>
            <li style={styles.step}>
              <button style={styles.stepButton}>1. Project</button>
            </li>
            <li style={styles.step}>
              <button style={styles.stepButton}>2. Dataset</button>
            </li>
            <li style={styles.step}>
              <button style={styles.stepButton}>3. Preprocessing</button>
            </li>
            <li style={styles.step}>
              <button style={styles.stepButton}>4. Model</button>
            </li>
            <li style={styles.step}>
              <button style={styles.stepButton}>5. Training</button>
            </li>
            <li style={styles.step}>
              <button style={styles.stepButton}>6. Evaluation</button>
            </li>
            <li style={styles.step}>
              <button style={styles.stepButton}>7. Leaderboard</button>
            </li>
            <li style={styles.step}>
              <button style={styles.stepButton}>8. Export</button>
            </li>
          </ol>
        </nav>
      </header>

      <main aria-label="Application content" style={styles.main}>
        <div style={styles.welcome}>
          <h2>Welcome to OpenNeural</h2>
          <p>
            Select a step from the navigation above to begin your machine learning
            workflow.
          </p>
          <p style={styles.hint}>
            Start by creating a new project or opening an existing one.
          </p>
        </div>
      </main>

      <footer style={styles.footer}>
        <span>OpenNeural v0.1.0</span>
        <span aria-hidden="true">|</span>
        <span>Local ML Experimentation Platform</span>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
    backgroundColor: "#f9fafb",
  },
  header: {
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    padding: "1rem 1.5rem",
    display: "flex",
    alignItems: "center",
    gap: "2rem",
  },
  title: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#111827",
  },
  nav: {
    flex: 1,
  },
  stepList: {
    display: "flex",
    listStyle: "none",
    margin: 0,
    padding: 0,
    gap: "0.5rem",
  },
  step: {
    display: "flex",
  },
  stepButton: {
    padding: "0.5rem 0.75rem",
    backgroundColor: "transparent",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    color: "#374151",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  main: {
    flex: 1,
    padding: "2rem",
    display: "flex",
    flexDirection: "column",
  },
  welcome: {
    maxWidth: "600px",
    margin: "0 auto",
    textAlign: "center",
    padding: "3rem 2rem",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  hint: {
    color: "#6b7280",
    fontSize: "0.875rem",
    marginTop: "1rem",
  },
  footer: {
    backgroundColor: "#ffffff",
    borderTop: "1px solid #e5e7eb",
    padding: "1rem 1.5rem",
    display: "flex",
    justifyContent: "center",
    gap: "0.5rem",
    fontSize: "0.875rem",
    color: "#6b7280",
  },
};
