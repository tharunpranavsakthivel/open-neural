/**
 * Vite configuration for the OpenNeural React renderer.
 *
 * Exports the Vite config consumed by the frontend workspace. The relative base
 * path keeps built assets loadable from Electron's file protocol. Server port is
 * set to 0 to allow dynamic port allocation, preventing conflicts when running
 * alongside other development services.
 */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base path for Electron file:// protocol compatibility
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    // Port 0 allows dynamic allocation to avoid conflicts
    port: 0,
    strictPort: false
  },
  build: {
    // Output to dist/ for Electron packaging
    outDir: "dist",
    // Generate source maps for debugging
    sourcemap: true,
    // Ensure assets use relative paths for file:// protocol
    assetsDir: "assets"
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    cache: false
  }
});

