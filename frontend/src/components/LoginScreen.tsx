/**
 * LoginScreen component - password authentication screen.
 *
 * Displays password input form for returning users. Validates password
 * against stored bcrypt hash via Electron API.
 *
 * @module components/LoginScreen
 */
import { useState } from "react";

interface LoginScreenProps {
  /** Callback invoked when login is successful */
  onLogin: () => void;
}

/**
 * Login screen for returning users.
 *
 * @param props - Component props
 * @param props.onLogin - Callback when login is successful
 * @returns The login screen
 */
export function LoginScreen({ onLogin }: LoginScreenProps): JSX.Element {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await window.electronAPI.validatePassword(password);

      if (result.success) {
        onLogin();
      } else {
        setError(result.error || "Invalid password");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <main aria-labelledby="login-title" style={styles.main}>
        <h1 id="login-title" style={styles.title}>
          OpenNeural
        </h1>
        <p style={styles.description}>
          Enter your password to access your workspace.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              style={styles.input}
            />
          </div>

          {error && (
            <div role="alert" style={styles.error}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !password}
            style={{
              ...styles.button,
              ...(isSubmitting || !password ? styles.buttonDisabled : {}),
            }}
          >
            {isSubmitting ? "Authenticating..." : "Sign In"}
          </button>
        </form>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#f9fafb",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  main: {
    width: "100%",
    maxWidth: "400px",
    padding: "2rem",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  title: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#111827",
  },
  description: {
    margin: "0 0 1.5rem 0",
    color: "#6b7280",
    fontSize: "0.875rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
  },
  input: {
    padding: "0.5rem 0.75rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    lineHeight: 1.5,
  },
  error: {
    padding: "0.75rem",
    backgroundColor: "#fee2e2",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    color: "#dc2626",
    fontSize: "0.875rem",
  },
  button: {
    padding: "0.75rem 1rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  buttonDisabled: {
    backgroundColor: "#9ca3af",
    cursor: "not-allowed",
  },
};
