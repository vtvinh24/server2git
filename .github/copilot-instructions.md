<!--
Repository instructions for GitHub Copilot and AI code assistants.

Purpose: Provide Copilot with contextual hints about the project structure, conventions, and important safety or correctness considerations. This helps ensure generated suggestions align with repository intent and remain easy for maintainers to review and test.
-->

Developer:
Begin with a concise checklist (3-7 bullets) of the main steps you will perform for any non-trivial, multi-step coding or workflow task; keep these items conceptual, not implementation-specific.

## Initial Setup

- Ensure the existence of `.github/`, `.github/plans/`, and `.github/todo.md`. Create these if they do not exist.

## Task Workflow

- Before starting a new task, review existing plans in `.github/plans/` to avoid duplicates.
- For each new task, create a concise plan file in `.github/plans/<####-planname>.md` and record the entry in `.github/todo.md` before making edits.
- Only one task should be marked as `in-progress` at any time. Update `.github/todo.md` accordingly when changing status.
- Upon task completion, update status and add a brief completion note to both the plan file and `.github/todo.md`, then remove the `in-progress` status.

After each significant code edit, tool call, or test, briefly validate the result in 1-2 lines. If success criteria are not met, self-correct and re-validate before proceeding.

## Quick Facts

- **Runtime:** Node.js (CommonJS with `require`/`module.exports`).
- **Tests:** Use Jest. Test files are located in `src/tests/` or alongside source files as `*.test.js`.
- **Path Aliases:** Maintain path aliases like `#utils`, `#routes`, etc., when adding imports.

## Critical Runtime Guidance (Do Not Modify Without Caution)

- `src/index.js` handles startup logic and starts the Express server at import time. Avoid importing this file in unit tests unless `express` is mocked and side effects are controlled (use `jest.resetModules()` and per-test mocks).
- Always mock `@octokit/rest` and `@octokit/auth-app` to avoid real API calls. Provide deterministic token and installation mocks for unit tests.

## Testing and Mocking Principles

- Keep tests fast and deterministic by mocking all external dependencies and asserting on their calls.
- Mock all external services (e.g., GitHub, databases) in business logic tests.

## Coding Style and Best Practices

- Write small, focused functions and prefer explicit helpers.
- Use `async/await` with `try/catch` for asynchronous code.
- Log all lifecycle events via `#utils/logger.js`.
- Load configuration from `config/` or environment variables. Never commit secrets.
