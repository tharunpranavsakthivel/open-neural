# OpenNeural Frontend

The user interface for OpenNeural, built with React, TypeScript, Vite, and TailwindCSS, communicating with the backend via local HTTP requests.

## Setup and Installation

Ensure you have Node.js (v18 or newer) installed.

From the `frontend` directory, install the required packages:
```bash
npm install
```

## Running the Vite Development Server

To start the Vite development server locally:

```bash
npm run dev
```

By default, this launches the server on `http://localhost:5173`. In production/Electron mode, the renderer process accesses the frontend through Vite or a loaded index file depending on the environment.

## Regenerating API Types

API types are auto-generated from the OpenAPI schema exposed by the FastAPI backend server.

1. Ensure the FastAPI backend server is running (e.g., on port `8765`).
2. Run the regeneration script from the `frontend` directory:
   ```bash
   npm run generate-api
   ```
   This fetches the OpenAPI spec from the running backend and generates typed client models and Axios query hooks.

## Running Tests

We use `Vitest` for unit and component testing.

To run the Vitest test runner:
```bash
npm run test
```

To run tests with UI reporting:
```bash
npm run test:ui
```

To collect test coverage:
```bash
npm run coverage
```
