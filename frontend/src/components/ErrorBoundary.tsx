/**
 * ErrorBoundary component - catches unexpected renderer exceptions.
 *
 * A React class component that implements the error boundary pattern to catch
 * JavaScript errors anywhere in the child component tree. When an error is caught,
 * it displays a "Something went wrong" screen with the error message and a
 * "Restart App" button that reloads the application.
 *
 * Per Task 200: Implements global error boundary as specified in the PRD.
 * Per INSTRUCTIONS.md §5: Error messages include what failed and how to resolve.
 *
 * @module components/ErrorBoundary
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Props for the ErrorBoundary component.
 */
interface ErrorBoundaryProps {
  /** Child components to render and monitor for errors */
  children: ReactNode;
  /** Optional custom fallback UI to render when an error occurs */
  fallback?: ReactNode;
}

/**
 * State for the ErrorBoundary component.
 */
interface ErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean;
  /** The error that was caught, if any */
  error: Error | null;
  /** React component stack trace where the error occurred */
  errorInfo: ErrorInfo | null;
}

/**
 * Global error boundary component for catching unexpected renderer exceptions.
 *
 * Features:
 * - Catches JavaScript errors anywhere in the component tree
 * - Displays a user-friendly error screen with error details
 * - Provides a "Restart App" button to reload the application
 * - Logs errors to console for debugging
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  /**
   * Initialize the error boundary with no error state.
   */
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Update state when an error is caught.
   *
   * This static method is called when an error is thrown in a child component.
   * It returns the new state to indicate an error has occurred.
   *
   * @param error - The error that was thrown
   * @returns The updated state with hasError set to true
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Log error details when an error is caught.
   *
   * This lifecycle method is called after an error has been caught.
   * It receives the error and React's error info containing the component stack.
   *
   * @param error - The error that was thrown
   * @param errorInfo - React error info with component stack
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details for debugging
    console.error("ErrorBoundary caught an error:", error);
    console.error("Component stack:", errorInfo.componentStack);

    // Update state with error info for display
    this.setState({
      errorInfo,
    });

    // In production, you might want to send this to an error reporting service
    // Example: reportErrorToService(error, errorInfo);
  }

  /**
   * Handle restart button click.
   *
   * Reloads the application window to recover from the error state.
   */
  handleRestart = (): void => {
    // Reload the application
    window.location.reload();
  };

  /**
   * Render the error boundary.
   *
   * If an error has been caught, render the error screen.
   * Otherwise, render the child components normally.
   */
  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Render custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Render the default error screen
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            {/* Error Icon */}
            <div style={styles.iconContainer}>
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={styles.errorIcon}
              >
                <path
                  d="M12 8V12M12 16H12.01M10.29 3.86L1.82 18C1.645 18.302 1.553 18.645 1.553 18.994C1.553 19.343 1.645 19.686 1.82 19.988C1.995 20.29 2.247 20.539 2.55 20.71C2.853 20.881 3.196 20.967 3.545 20.96H20.455C20.804 20.967 21.147 20.881 21.45 20.71C21.753 20.539 22.005 20.29 22.18 19.988C22.355 19.686 22.447 19.343 22.447 18.994C22.447 18.645 22.355 18.302 22.18 18L13.71 3.86C13.532 3.566 13.28 3.323 12.98 3.156C12.68 2.988 12.343 2.902 12 2.902C11.657 2.902 11.32 2.988 11.02 3.156C10.72 3.323 10.468 3.566 10.29 3.86Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Title */}
            <h1 style={styles.title}>Something went wrong</h1>

            {/* Error Message */}
            <p style={styles.description}>
              An unexpected error occurred in the application. The error details
              are shown below.
            </p>

            {/* Error Details */}
            <div style={styles.errorDetails}>
              <p style={styles.errorMessage}>
                <strong>Error:</strong> {error?.message || "Unknown error"}
              </p>
              {error?.name && (
                <p style={styles.errorType}>
                  <strong>Type:</strong> {error.name}
                </p>
              )}
            </div>

            {/* Component Stack (collapsible in production, shown in development) */}
            {errorInfo?.componentStack && (
              <details style={styles.stackDetails}>
                <summary style={styles.stackSummary}>Component Stack</summary>
                <pre style={styles.stackTrace}>{errorInfo.componentStack}</pre>
              </details>
            )}

            {/* Action Button */}
            <button
              onClick={this.handleRestart}
              style={styles.restartButton}
              aria-label="Restart the application"
            >
              Restart App
            </button>

            {/* Additional Help */}
            <p style={styles.helpText}>
              If the problem persists after restarting, please check the
              application logs or contact support.
            </p>
          </div>
        </div>
      );
    }

    // No error, render children normally
    return children;
  }
}

/**
 * Styles for the error boundary error screen.
 */
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    padding: "2rem",
    backgroundColor: "#f9fafb",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  card: {
    maxWidth: "600px",
    width: "100%",
    padding: "2.5rem",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    textAlign: "center",
  },
  iconContainer: {
    marginBottom: "1.5rem",
  },
  errorIcon: {
    color: "#dc2626",
  },
  title: {
    margin: "0 0 1rem 0",
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#111827",
  },
  description: {
    margin: "0 0 1.5rem 0",
    fontSize: "0.875rem",
    color: "#6b7280",
    lineHeight: 1.5,
  },
  errorDetails: {
    padding: "1rem",
    marginBottom: "1rem",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    textAlign: "left",
  },
  errorMessage: {
    margin: "0 0 0.5rem 0",
    fontSize: "0.875rem",
    color: "#dc2626",
    wordBreak: "break-word",
  },
  errorType: {
    margin: 0,
    fontSize: "0.75rem",
    color: "#7f1d1d",
  },
  stackDetails: {
    marginBottom: "1.5rem",
    textAlign: "left",
  },
  stackSummary: {
    padding: "0.75rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
    cursor: "pointer",
    backgroundColor: "#f3f4f6",
    borderRadius: "6px",
    userSelect: "none",
  },
  stackTrace: {
    padding: "1rem",
    margin: "0.5rem 0 0 0",
    fontSize: "0.75rem",
    fontFamily: "monospace",
    color: "#374151",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxHeight: "200px",
    overflowY: "auto",
  },
  restartButton: {
    display: "inline-block",
    padding: "0.875rem 2rem",
    marginBottom: "1rem",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  helpText: {
    margin: 0,
    fontSize: "0.75rem",
    color: "#9ca3af",
  },
};

export default ErrorBoundary;
