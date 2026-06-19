# AGENTS.md — Kilo Code Agent Rules

This file defines the behavioral rules, coding standards, and decision-making guidelines
for AI agents (including Kilo Code) operating in this repository. All agents must read
and adhere to these rules before performing any task.

---

## 1. Task Completion Mindset

- Always work towards **full, functional completion** of the assigned task. Do not stop
  at a partial solution unless explicitly instructed or blocked by a missing dependency.
- Break complex tasks into clear, sequential subtasks. Complete each subtask before
  moving to the next, and validate the result at each stage.
- If a task is ambiguous or the requirements conflict, resolve the ambiguity before
  writing code — not after. A correct plan executed well beats a fast plan executed wrong.
- Do not leave `TODO`, `FIXME`, or `HACK` comments as permanent artifacts. If something
  cannot be completed in the current session, document it in a clearly named issue or
  note and flag it explicitly in your response.
- Prefer shipping a working, scoped solution over a large, incomplete one. If the full
  scope cannot be completed, deliver a working subset and communicate what remains.

---

## 2. Context Gathering

- **Always ask for clarification** before beginning work when:
  - The task description is vague or missing key details (e.g., "fix the bug" with no
    reproduction steps).
  - The expected output format, data shape, or interface is not specified.
  - Multiple valid interpretations exist and choosing the wrong one would waste significant
    effort.
  - External dependencies (APIs, services, credentials, environment variables) are
    referenced but not defined.
- Ask focused, specific questions. Do not ask for information you can reasonably infer
  from the existing codebase or context.
- Before modifying existing code, read the surrounding file(s), understand the existing
  patterns, and confirm you understand the intent — do not refactor blindly.
- When reading unfamiliar code, trace the data flow from entry point to output before
  making changes.

---

## 3. Code Comments & Documentation

- Every file must include a **top-level docblock** describing its purpose, what it
  exports/exposes, and any critical dependencies or side effects.
- Every function, method, and class must include a docstring or block comment covering:
  - What it does (purpose, not implementation detail).
  - Parameters: name, type, and what they represent.
  - Return value: type and what it represents.
  - Any exceptions or edge cases it handles or throws.
- Inline comments must explain **why**, not **what**. The code explains what; the
  comment explains the reasoning, constraint, or tradeoff behind a decision.
- Mark all non-obvious logic, workarounds, or external constraints with a comment that
  provides enough context for a reader with no prior knowledge to understand the
  decision without asking.
- When calling external APIs, annotate the call site with: the endpoint purpose, the
  shape of the expected response, and the handling strategy for failure cases.

  ```python
  # Fetches the latest embeddings for a given document chunk.
  # Returns: { "embedding": List[float], "model": str }
  # On 429 (rate limit), we back off exponentially and retry up to 3 times.
  response = client.embeddings.create(model="text-embedding-3-small", input=chunk_text)
  ```

---

## 4. Standard Coding Practices

- Follow the language-specific style guide for the project (e.g., PEP 8 for Python,
  Airbnb/Standard for JavaScript/TypeScript, `gofmt` for Go). If no guide is defined,
  adopt the most widely accepted community standard for that language.
- Use **meaningful, unambiguous names** for variables, functions, classes, and files.
  Avoid abbreviations unless they are universally understood in the domain (e.g., `url`,
  `id`, `api`).
- Functions and methods must do **one thing**. If a function requires a long comment to
  explain all the things it does, it should be split.
- Keep functions short. As a general rule, if a function exceeds 40–50 lines, consider
  whether it should be decomposed.
- Avoid deeply nested code. Prefer early returns, guard clauses, and extracted helper
  functions to reduce nesting depth.
- Never hardcode secrets, credentials, API keys, or environment-specific values.
  Use environment variables or a secrets manager, and document the required variables
  in `.env.example` or the project README.
- Write **idempotent** functions wherever possible. A function called multiple times
  with the same inputs should produce the same result without unintended side effects.

---

## 5. Error Handling

- Every external call (network, filesystem, database, subprocess) must be wrapped in
  explicit error handling. Silent failures are not acceptable.
- Distinguish between recoverable and unrecoverable errors. Recoverable errors (e.g.,
  transient network failure) should trigger a retry or fallback; unrecoverable errors
  (e.g., corrupted required config) should fail fast with a clear, actionable message.
- Error messages must include:
  - What failed.
  - Why it failed (if determinable).
  - What the caller or user can do to resolve it.
- Do not swallow exceptions with empty `except` / `catch` blocks. Log the error at
  minimum, and re-raise if the caller needs to be aware.
- Validate all user-provided and external inputs at the boundary (entry point of the
  system). Do not assume inputs are safe, correctly typed, or within expected ranges.

---

## 6. Testing

- Every new function, class, or module must have corresponding unit tests. No exceptions.
- Tests live in the `test/` directory at the project root, mirroring the source tree
  structure (e.g., `src/utils/parser.py` → `test/utils/test_parser.py`).
- Each test must be:
  - **Isolated**: no shared mutable state between tests.
  - **Deterministic**: same input always produces the same result.
  - **Fast**: unit tests should not make real network or database calls; mock
    external dependencies.
- Cover at minimum: the happy path, edge cases (empty input, boundary values), and
  known failure modes.
- When fixing a bug, write a regression test that reproduces the bug **before** writing
  the fix. The test should fail before the fix and pass after.
- Integration tests (where applicable) must be clearly labeled and separated from unit
  tests so they can be run independently.

---

## 7. File & Project Organization

- Follow the existing directory structure of the project. Do not create new top-level
  directories without confirming with the user.
- One module, one responsibility. Files should not mix unrelated concerns (e.g., routing
  logic and database models in the same file).
- Shared utilities, constants, and types must live in a dedicated `utils/`, `constants/`,
  or `types/` module — not scattered across feature files.
- Configuration files (linting, formatting, build tools) must be placed at the project
  root and documented in the README if they require developer setup.
- Avoid deeply nested directory structures. More than 3–4 levels of nesting is usually
  a sign of over-engineering.

---

## 8. Version Control & Change Hygiene

- Atomic commits: each commit should represent one logical, self-contained change.
  Do not bundle unrelated changes into a single commit.
- Commit messages must follow the format:
  ```
  <type>(<scope>): <short summary>

  <optional body explaining why, not what>
  ```
  Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`.
- Do not commit generated files, build artifacts, or editor-specific configs unless they
  are intentionally part of the repository (documented in the README).
- Never commit directly to `main` or `master`. All changes must go through a branch and,
  where applicable, a pull request.
- If modifying a file that is not directly related to the assigned task, stop and confirm
  with the user before proceeding — scope creep corrupts intent.

---

## 9. Security Practices

- Never introduce code that logs, stores, or transmits secrets, tokens, passwords,
  or PII in plaintext.
- Sanitize and validate all inputs before using them in SQL queries, shell commands,
  file paths, or template rendering to prevent injection attacks.
- When integrating third-party libraries, prefer well-maintained packages with clear
  licensing. Flag any dependency with known CVEs before adding it.
- Principle of least privilege: code should request only the permissions it strictly
  needs. Do not request broad access when narrow access is sufficient.
- If authentication or authorization logic is modified, explicitly note this in the
  commit message and request a review.

---

## 10. Performance Awareness

- Profile before optimizing. Do not prematurely optimize code without evidence of a
  bottleneck (measurement first, optimization second).
- For algorithms operating on non-trivial data, document the time and space complexity
  in the function docstring (e.g., `O(n log n)` time, `O(n)` space).
- Avoid N+1 query patterns. When fetching relational data in a loop, use batch queries,
  joins, or eager loading.
- Cache expensive or repeated computations only when the cache invalidation strategy
  is clearly defined and documented alongside the cache.
- Use pagination, streaming, or chunking when handling large datasets. Never load an
  unbounded dataset into memory.

---

## 11. Communication & Transparency

- Before starting any non-trivial task, output a brief **plan** describing the approach,
  the files that will be modified, and any assumptions being made.
- After completing a task, provide a concise **summary** of what was done, what was
  not done (and why), and any follow-up actions the user should take.
- If a chosen implementation has known tradeoffs (e.g., speed vs. memory, simplicity
  vs. extensibility), state them explicitly so the user can make an informed decision.
- When something is uncertain (e.g., unclear requirement, missing context, unfamiliar
  domain), say so explicitly rather than guessing silently.
- Do not fabricate API signatures, library behaviors, or language features. If you are
  not certain a function or method exists, verify it in the codebase or documentation
  before using it.

---

## 12. Respect for Existing Code

- Do not refactor or restructure code that is outside the scope of the assigned task.
  Unsolicited refactoring introduces risk and scope creep.
- If you identify a bug or code smell adjacent to the task, note it in a comment or
  flag it to the user — but do not fix it without explicit approval.
- Preserve the existing naming conventions, formatting style, and architectural patterns
  of the project. Consistency within a codebase matters more than adherence to an
  external style guide.
- If the existing code has tests, run them before and after your changes to ensure
  nothing is broken. A passing test suite before your change that fails after is a
  regression you introduced.

---

## 13. Dependency Management

- Do not add new dependencies without explicitly listing them and explaining why the
  existing toolchain cannot satisfy the requirement.
- Prefer the standard library over third-party packages for straightforward tasks.
- Pin dependency versions in lock files (`package-lock.json`, `poetry.lock`,
  `requirements.txt` with pinned versions). Unpinned dependencies create non-reproducible
  builds.
- When removing a dependency, verify it is not used anywhere else in the project before
  removing it from the manifest.

---

## 14. Accessibility & Inclusivity (Frontend)

- All interactive UI elements must have appropriate ARIA labels, roles, and keyboard
  navigation support.
- Do not rely solely on color to convey information — pair with text labels, icons,
  or patterns.
- Ensure sufficient color contrast ratios (WCAG AA minimum: 4.5:1 for normal text,
  3:1 for large text).
- All images must have descriptive `alt` text; decorative images must have `alt=""`.

---

## Quick Reference Checklist

Before submitting or applying any change, verify:

- [ ] Task is fully completed or scope reduction is clearly communicated.
- [ ] All new functions/classes have docstrings and inline comments for non-obvious logic.
- [ ] No hardcoded secrets, credentials, or environment-specific values.
- [ ] Error handling covers all external calls and user inputs.
- [ ] Unit tests exist for all new logic and pass locally.
- [ ] No unrelated files were modified.
- [ ] Commit message follows the defined format.
- [ ] New dependencies are justified and pinned.
- [ ] A summary of changes and any outstanding items is provided.