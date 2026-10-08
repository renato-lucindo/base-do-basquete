# Stage 4 automated GitHub Actions validation

The workflow `.github/workflows/stage4-validation.yml` runs automatically on pushes to `codex/manual-scoresheet-v2` and can be started with `workflow_dispatch`.

It runs these stages in order:

1. **Security + statistics:** starts disposable Supabase/Postgres, executes all pgTAP tests (including `manual_scoresheet_v2_review_security.test.sql`) and concurrency checks. It verifies AAL2/anon permissions, publication RLS, immutable snapshots, transaction rollback, FIBA metrics, and collective free throws.
2. **Historical schema upgrade:** reconstructs the 62 recorded Supabase migration versions, preserving five local bootstrap prerequisites and substituting known historical SQL differences, then incrementally applies four Stage 4 migrations and runs focused pgTAP regressions. This is *not* a byte-for-byte database clone.
3. **QA:** format, lint, typecheck, unit tests, build, secret scan, end-to-end/accessibility checks.
4. **Integration:** runs read-only `git merge-tree` against `origin/main`. Fails if the PR has unresolved merge conflicts.

No job accesses, modifies, or pushes to the shared Supabase project; no secrets or personal data are copied. A failing gate is a real blocker. **These are automated technical checks, not formal opinions from the repository's independent Codex reviewers.** The existing `.agents/agent-contract.md` remains in force for merge/release.

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: GitHub Actions Stage 4 Validation, PR #72
ACAO: verify all stages on current HEAD; resolve findings and main conflicts without discarding WIP; request independent security/statistics/QA review.
CRITERIO_DE_CONCLUSAO: all automation green, no material regressions, independent required reviewer opinions and no production deployment before authorization.
```
