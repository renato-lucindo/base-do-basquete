---
name: managing-base-work-unit
description: Reconcile and manage a Base do Basquete work unit. Use when starting, resuming, handing off, or closing work involving branch, HEAD, HANDOFF, WRITE_LOCK, REVIEW_PACKET, or remote-state changes.
---

# Managing a Base do Basquete work unit

Follow [AGENTS.md](../../../AGENTS.md), [HANDOFF.md](../../../HANDOFF.md), and the [agent contract](../../../.agents/agent-contract.md). This skill operationalizes those sources; it does not replace them.

## Establish the unit

1. Run `node .codex/skills/managing-base-work-unit/scripts/inspect-work-unit.mjs` from the repository root.
2. Compare its output with `HANDOFF.md` and any relevant PR or service state.
3. Preserve pre-existing changes. Correct a material handoff divergence before implementation.
4. Define one `WORK_UNIT` with objective, acceptance criteria, scope, negative scope, branch, base, and required reviewers.
5. Record an active `WRITE_LOCK` before mutation. Only `project-maintainer` may own it.

Read only the plan documents needed by the unit. Do not load the full plan corpus for a narrow change.

## Prepare review

- Stabilize the unit before requesting review.
- Build the exact `REVIEW_PACKET` from the agent contract.
- Select reviewers by the contract's risk triggers.
- Keep the HEAD fixed while reviews run. Material changes expire opinions.
- Treat scout reports as investigation, never as approval.

## Close or hand off

- Record real tests, checks, remote state, residual risks, and uncommitted changes.
- Release the `WRITE_LOCK` only when the unit is complete or consistently handed off.
- End with a file or service, a concrete action, and an observable completion criterion.
- Do not claim a push, check, preview, migration, or deployment that was not verified.
