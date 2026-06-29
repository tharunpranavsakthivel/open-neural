# OpenNeural Security Policy & Architecture

OpenNeural is designed with security and privacy as first-class citizens. Because academic research and proprietary data demand the highest levels of privacy, OpenNeural implements a strict **zero-trust local-only** security model.

---

## 1. Core Security Design Decisions

### 1.1 Local-Only Data & Network Isolation
- **No Telemetry or Phone-Home**: OpenNeural does not track usage statistics, log events, or report telemetry. No external outbound network requests are made by the application during runtime.
- **Localhost Binding**: The Python FastAPI backend binds exclusively to the loopback interface (`127.0.0.1`). It actively refuses connections from `0.0.0.0` or any other external interface, ensuring that the backend cannot be reached from other machines on your local network.
- **Offline Capability**: Once installed, OpenNeural does not require or query DNS or internet connectivity.

### 1.2 Bcrypt Authentication
- **First-Launch Credentialing**: On first launch, the user establishes a local master password. This password is typed once and immediately hashed using **Bcrypt** with a CPU-intensive work cost factor of **12**.
- **Secure Validation Architecture**: The Electron main process accesses the SQLite database directly via the `better-sqlite3` library to validate the master password. The React-based renderer process never receives the raw password, session tokens, or the hashed credential, preventing exposure via cross-site scripting (XSP) or DOM sniffing.

### 1.3 Ephemeral Secrets (IPC Security)
- **Local Request Authentication**: To secure communication between the Electron main process (frontend GUI) and the Python FastAPI subprocess (machine learning worker), a **shared ephemeral secret** is cryptographically generated at application startup.
- **Injection & Verification**: This secret is injected directly into the Python subprocess's environment variables at spawn time. It is never persisted on disk.
- **Request Validation**: The Electron main process attaches this secret to every single HTTP request in the `X-OpenNeural-Secret` custom header. The FastAPI app employs a global middleware to intercept and validate this header:
  - If the secret is correct, the request is processed.
  - If the secret is missing, empty, or incorrect, the request is immediately rejected with `401 Unauthorized`.

### 1.4 Content Security Policy (CSP) and Renderer Security
- **Strict Host Isolation**: In the Electron frontend, `nodeIntegration` is set to `false`, and `contextIsolation` is set to `true`. This ensures the rendering environment cannot directly execute Node.js APIs or shell commands.
- **Context Bridge**: Access to safe desktop APIs (such as window resizing or initiating file exports) is provided via a narrow, strictly validated `contextBridge` exposed through the preload script.
- **Content-Security-Policy (CSP)**: The renderer process enforces a strict CSP meta tag to prevent inline script execution and restrict external resource loading (e.g., `default-src 'self'`).

### 1.5 SQLite Write-Ahead Logging (WAL) Mode
- **Corruption Prevention**: To prevent database corruption in the event of a sudden computer crash, power outage, or force-quit, SQLite is configured in **Write-Ahead Logging (WAL) Mode** (`PRAGMA journal_mode=WAL`).
- **Graceful Shutdown**: The Python backend registers a `SIGTERM`/`SIGINT` signal handler to flush active database transactions and mark interrupted experiments as `failed` rather than leaving them in a dangling `running` state.
- **Main Process Orchestration**: The Electron main process intercepts the quit event and sends a graceful `SIGTERM` to the backend, waiting up to **5 seconds** for orderly shutdown before resorting to a forced `SIGKILL`.

### 1.6 File Permissions & Data Isolation
- **Secure File Storage**: When datasets are imported, they are copied into the user's home folder at `~/openneural/snapshots/` and formatted as secure, read-optimized Parquet files.
- **Owner-Only Read/Write**: Snapshot files are written to disk with OS-level permissions set to `600` (on Unix/macOS), meaning only the owner of the user profile can read or write these files. Other system users are completely blocked from accessing your research data.

---

## 2. Verifying Exported Artifact Checksums

OpenNeural automatically generates a SHA-256 checksum for all exported artifacts (models, pipeline configurations, and evaluation reports) to ensure that the scientific findings remain completely authentic and unaltered when shared with other researchers.

### 2.1 The Export Manifest File
Every export contains a `manifest.json` or individual `.sha256` checksum files alongside your model (e.g., `model.onnx`). The checksum file contains the cryptographic hash of the file:

```
a3f5b72186...c7e901a8ef  model.onnx
```

### 2.2 How to Verify the Checksum

To verify that the model has not been altered or corrupted since it was exported from OpenNeural, downstream users can run standard terminal commands:

#### On macOS (Terminal)
```bash
shasum -a 256 model.onnx
```
Compare the output string to the contents of the `model.onnx.sha256` file.

#### On Linux (Bash)
```bash
sha256sum --check model.onnx.sha256
```
This command automatically reads the checksum file and validates the corresponding artifact, returning `model.onnx: OK` if the integrity is intact.

#### On Windows (PowerShell)
```powershell
Get-FileHash .\model.onnx -Algorithm SHA256
```
Compare the resulting `Hash` field to the exported SHA-256 value.
