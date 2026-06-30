/**
 * LoginScreen component - password authentication screen.
 *
 * Displays a single password input field. On submit, calls the Electron main
 * process via window.electronAPI.validatePassword() which validates against
 * the bcrypt hash in SQLite. On success, transitions to the main app.
 * On failure, shows an inline "Incorrect password" error message.
 *
 * @module screens/LoginScreen
 */
import { useState } from "react";
import { useAppStore } from "../stores/appStore";

interface LoginScreenProps {
  /** Callback invoked when login is successful */
  onLogin: () => void;
}

/**
 * Login screen for returning users.
 *
 * Features:
 * - Single password input field with auto-focus
 * - Calls Electron IPC auth:validate-password on submit
 * - Validates against bcrypt hash stored in SQLite
 * - Shows inline "Incorrect password" error on failure
 * - Transitions to main app on success (backend already has ephemeral secret)
 *
 * @param props - Component props
 * @returns The login screen
 */
export function LoginScreen({ onLogin }: LoginScreenProps): JSX.Element {
  const { showErrorToast } = useAppStore();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handle form submission.
   *
   * Calls window.electronAPI.validatePassword() which internally uses
   * ipcRenderer.invoke('auth:validate-password', password). The Electron
   * main process validates the password against the bcrypt hash in SQLite.
   *
   * @param e - Form submit event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError("Please enter your password");
      return;
    }

    setIsSubmitting(true);

    try {
      // Call Electron IPC to validate password
      // This validates against the bcrypt hash stored in SQLite
      const result = await window.electronAPI.validatePassword(password);

      if (result.success) {
        // Password validated successfully
        // The backend is already spawned with the ephemeral secret
        // We can now transition to the main application
        onLogin();
      } else {
        // Show inline error - specifically "Incorrect password" as per task
        const errorMessage = result.error || "Incorrect password";
        setError(errorMessage);

        // Show error toast for additional feedback
        showErrorToast(errorMessage);
      }
    } catch (err) {
      // Handle unexpected errors (not authentication failures)
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      showErrorToast(errorMessage);
    } finally {
      setIsSubmitting(false);
      // Clear password field for security
      setPassword("");
    }
  };

  return (
    <div style={styles.container}>
      <main aria-labelledby="login-title" style={styles.main}>
        <div style={styles.logoContainer}>
          <div style={styles.logo}>
            <svg
              width="48"
              height="48"
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
          <h1 id="login-title" style={styles.title}>
            OpenNeural
          </h1>
        </div>

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
              autoComplete="current-password"
              aria-describedby={error ? "password-error" : undefined}
              aria-invalid={error ? "true" : "false"}
              style={{
                ...styles.input,
                ...(error ? styles.inputError : {}),
              }}
            />
          </div>

          {error && (
            <div
              id="password-error"
              role="alert"
              aria-live="polite"
              style={styles.error}
            >
              <span style={styles.errorIcon} aria-hidden="true">
                ⚠️
              </span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !password.trim()}
            style={{
              ...styles.button,
              ...(isSubmitting || !password.trim()
                ? styles.buttonDisabled
                : {}),
            }}
          >
            {isSubmitting ? (
              <>
                <span style={styles.spinner} aria-hidden="true" />
                Authenticating...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p style={styles.hint}>
          Forgot your password? Contact your system administrator.
        </p>
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
    textAlign: "center",
  },
  logoContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: "1rem",
  },
  logo: {
    marginBottom: "0.75rem",
  },
  title: {
    margin: 0,
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
    textAlign: "left",
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
    padding: "0.75rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#d1d5db",
    borderRadius: "6px",
    fontSize: "0.875rem",
    lineHeight: 1.5,
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
  inputError: {
    borderColor: "#dc2626",
    boxShadow: "0 0 0 3px rgba(220, 38, 38, 0.1)",
  },
  error: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.75rem",
    backgroundColor: "#fee2e2",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    color: "#dc2626",
    fontSize: "0.875rem",
    textAlign: "left",
  },
  errorIcon: {
    flexShrink: 0,
  },
  button: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
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
  spinner: {
    display: "inline-block",
    width: "16px",
    height: "16px",
    border: "2px solid rgba(255, 255, 255, 0.3)",
    borderTopColor: "#ffffff",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  hint: {
    margin: "1.5rem 0 0 0",
    fontSize: "0.75rem",
    color: "#9ca3af",
  },
};
