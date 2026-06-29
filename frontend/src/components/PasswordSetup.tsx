/**
 * PasswordSetup component - first-time password creation screen.
 *
 * Displays password creation form for first-time users. Validates password
 * strength and confirmation before storing via Electron API.
 *
 * @module components/PasswordSetup
 */
import { useState } from "react";

interface PasswordSetupProps {
  /** Callback invoked when password setup is complete */
  onComplete: () => void;
}

/**
 * Password setup screen for first-time users.
 *
 * @param props - Component props
 * @param props.onComplete - Callback when setup is successful
 * @returns The password setup screen
 */
export function PasswordSetup({ onComplete }: PasswordSetupProps): JSX.Element {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate password locally first
      const validation = await window.electronAPI.validateSetupPassword(
        password,
        confirmPassword,
      );

      if (!validation.success) {
        setError(validation.error || "Password validation failed");
        setIsSubmitting(false);
        return;
      }

      // Store the password
      const result = await window.electronAPI.storePassword(password);

      if (result.success) {
        onComplete();
      } else {
        setError(result.error || "Failed to store password");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <main aria-labelledby="setup-title" style={styles.main}>
        <h1 id="setup-title" style={styles.title}>
          Welcome to OpenNeural
        </h1>
        <p style={styles.description}>
          Set up a password to secure your local OpenNeural workspace.
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
              aria-describedby="password-hint"
              style={styles.input}
            />
            <p id="password-hint" style={styles.hint}>
              Use at least 8 characters with letters and numbers.
            </p>
          </div>

          <div style={styles.field}>
            <label htmlFor="confirm-password" style={styles.label}>
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
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
            disabled={isSubmitting || !password || !confirmPassword}
            style={{
              ...styles.button,
              ...(isSubmitting || !password || !confirmPassword
                ? styles.buttonDisabled
                : {}),
            }}
          >
            {isSubmitting ? "Setting up..." : "Create Password"}
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
  hint: {
    margin: "0.25rem 0 0 0",
    fontSize: "0.75rem",
    color: "#6b7280",
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
