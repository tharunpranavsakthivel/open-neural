/**
 * React renderer entry point for the OpenNeural frontend workspace.
 *
 * Mounts the top-level App component into the document root. Depends on React
 * 18's createRoot API and the Vite module runtime.
 *
 * Wrapped with ErrorBoundary to catch unexpected renderer exceptions and
 * display a user-friendly error screen with recovery options.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles/global.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Unable to start OpenNeural: missing #root mount element.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
