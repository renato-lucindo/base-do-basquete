---
name: reviewing-supabase-changes
description: Implement or review Base do Basquete Supabase changes. Use for migrations, schema, RLS, grants, RPCs, Auth, Storage, private data, idempotency, concurrency, or critical database writes.
---

# Reviewing Supabase changes

Apply [AGENTS.md](../../../AGENTS.md), the [security architecture](../../../docs/plan/ARQUITETURA-SEGURANCA.md), and the [agent contract](../../../.agents/agent-contract.md). Respect the caller's role: reviewers remain read-only; only the active maintainer may mutate state.

Read [database-review-checklist.md](references/database-review-checklist.md) for every matching change. Read [rollout-evidence.md](references/rollout-evidence.md) only when preparing or reviewing a rollout.

## Workflow

1. Identify the authoritative local and remote migration state before reasoning about a delta.
2. Confirm applied migrations are immutable and corrections are additive.
3. Review authorization and exposure together: RLS, grants, schemas, ownership, executable functions, `search_path`, Auth/`aal2`, Storage, DTOs, views, and logs.
4. Review integrity: constraints, foreign keys, indexes, transactions, idempotency, CAS, concurrency, audit, rollback, and reconciliation.
5. During implementation use focal pgTAP; at the stable gate use the complete database suite from a disposable database.
6. Regenerate or check types when the contract changes. Analyze advisors and explain warnings rather than hiding them.
7. Produce `SKILL_RESULT` from the agent contract with exact evidence and omitted gates.

Consult current official Supabase documentation for version-sensitive behavior. Never expose credentials or apply a shared migration merely because this skill is active.
