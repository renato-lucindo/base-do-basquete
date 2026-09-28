---
name: running-release-gate
description: Prepare or review a Base do Basquete merge or release. Use when a work unit is stable and needs final local gates, required opinions, CI, preview, deployment, smoke, benchmark, or rollback evidence.
---

# Running the release gate

Discover current commands from `package.json`, workflows, and runbooks. Do not treat examples in this skill as more authoritative than the repository.

Read [gate-matrix.md](references/gate-matrix.md). For production, also read the current release-candidate and rollback runbooks.

## Workflow

1. Confirm branch, base, HEAD, scope, required reviewers, and opinion validity.
2. Run the consolidated local gate once after the unit is stable. Add database, domain, browser, or performance gates according to the matrix.
3. Verify CI, CodeQL, preview, smoke, and commit/artifact identity. Explain any omission.
4. Reuse green evidence only when relevant code, migration, dependency, workflow, configuration, or evidence has not changed.
5. For production, confirm protected `main` or version, migration/application order, recoverable rollback, deployment identity, post-deploy smoke, and benchmark when applicable.
6. Return `READY`, `NOT_READY`, or `BLOCKED` and produce `SKILL_RESULT`.

Activation does not authorize merge, migration application, production deployment, or destructive recovery.
