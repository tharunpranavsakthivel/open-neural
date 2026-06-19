/**
 * Top-level React component for the initial OpenNeural renderer shell.
 *
 * Exposes the application landmark and startup status while later workspace
 * tasks add routing, auth, and backend connectivity.
 */
export function App(): JSX.Element {
  return (
    <main aria-labelledby="openneural-title">
      <h1 id="openneural-title">OpenNeural</h1>
      <p>React renderer initialized.</p>
    </main>
  );
}
