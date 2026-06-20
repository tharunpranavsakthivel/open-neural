/**
 * PasswordSetup screen - first-time password creation.
 *
 * Displays a password + confirmation password form. Validates passwords match
 * and meet minimum length (>= 8 chars). On submit, calls POST /api/v1/auth/setup.
 * On success, transitions to LoginScreen with a success toast.
 *
 * @module screens/PasswordSetup
 */
import { useState } from "react";
import { useAppStore } from "../stores/appStore";

interface PasswordSetupProps {
  /** Callback invoked when password setup is complete */
  onComplete: () => void;
}

/**
 * Password setup screen for first-time users.
 *
 * @param props - Component props
 * @returns The password setup screen
 */
export function PasswordSetup({ onComplete }: PasswordSetupProps): JSX.Element {
  const { backendPort, showSuccessToast } = useAppStore();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Validate password meets requirements.
   *
   * @param pwd - Password to validate
   * @returns Validation result with success flag and optional error message
   */
  function validatePassword(pwd: string): { success: boolean; error?: string } {
    if (pwd.length < 8) {
      return {
        success: false,
        error: "Password must be at least 8 characters long",
      };
    }
    return { success: true };
  }

  /**
   * Validate passwords match.
   *
   * @param pwd - Original password
   * @param confirm - Confirmation password
   * @returns Validation result with success flag and optional error message
   */
  function validatePasswordsMatch(
    pwd: string,
    confirm: string
  ): { success: boolean; error?: string } {
    if (pwd !== confirm) {
      return {
        success: false,
        error: "Passwords do not match",
      };
    }
    return { success: true };
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate password length
    const lengthValidation = validatePassword(password);
    if (!lengthValidation.success) {
      setError(lengthValidation.error || "Password validation failed");
      return;
    }

    // Validate passwords match
    const matchValidation = validatePasswordsMatch(password, confirmPassword);
    if (!matchValidation.success) {
      setError(matchValidation.error || "Passwords do not match");
      return;
    }

    if (!backendPort) {
      setError("Backend not connected");
      return;
    }

    setIsSubmitting(true);

    try {
      // Call POST /api/v1/auth/setup
      const response = await fetch(
        `http://127.0.0.1:${backendPort}/api/v1/auth/setup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      // Show success toast
      showSuccessToast("Password created successfully! Please log in.");

      // Transition to login screen
      onComplete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create password"
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && confirmPassword) {
                  e.preventDefault();
                  // Focus the confirm password field
                  document.getElementById("confirm-password")?.focus();
                }
              }}
              disabled={isSubmitting}
              autoFocus
              aria-describedby="password-hint"
              style={styles.input}
            />
            <p id="password-hint" style={styles.hint}>
              Use at least 8 characters
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && password && confirmPassword && !isSubmitting) {
                  e.preventDefault();
                  // Trigger form submission
                  const form = e.currentTarget.closest("form");
                  form?.requestSubmit();
                }
              }}
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
            {isSubmitting ? "Creating password..." : "Create Password"}
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
