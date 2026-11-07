# Autonomous Multi-Agent Engineering Protocol

Every feature addition, bug fix, or refactor must pass an autonomous 4-stage pipeline before being marked done:
* Stage 1 (Implementation): Produce minimal, non-destructive unified diffs.
* Stage 2 (QA & Bug Sweep): Run local linters, unit tests, and terminal builds. Inspect console output and catch syntax, runtime, and type errors. If tests fail, diagnose and self-heal automatically.
* Stage 3 (Optimization & State Audit): Inspect git diffs for unnecessary DOM reflows, unhandled Promise rejections, memory leaks, and redundant reactive state updates. Apply non-breaking optimizations.
* Stage 4 (Artifact Sign-off & Auto-Commit): Produce an Artifact summarizing: (1) Files changed, (2) Test results/status, (3) Optimizations applied. Automatically stage and create a local git commit for verified changes with a concise conventional commit message. Never run `git push` without explicit user instruction.

## Subagent Pipeline Roles (`.antigravity/subagents.json`)
- **`qa-verifier`**: Executes Stage 2 verification (Alpine.js template binding validation, JS syntax/lexical checks, data integrity checks, and test suites), inspects exit codes, and isolates failures for automatic self-healing.
- **`perf-optimizer`**: Executes Stage 3 audit on git diffs for DOM reflow bottlenecks, Alpine.js reactive overhead, memory leaks, and unhandled async rejections.

## Browser Verification & UI Subagents (`brave-devtools`)
- UI and QA subagents must utilize the `brave-devtools` MCP server whenever live browser DOM verification, console log capture, responsive layout checks, or UI screenshot inspections are required.
- Connect to or launch Brave with remote debugging (`--remote-debugging-port=9222`) using the workspace launch scripts (`start-brave-debug.bat` / `.ps1` / `.sh`).
