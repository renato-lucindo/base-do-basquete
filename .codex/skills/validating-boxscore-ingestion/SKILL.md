---
name: validating-boxscore-ingestion
description: Implement or validate Base do Basquete boxscore ingestion. Use for FIBA or Basketball Site PDF extraction, parsing, matching, review, team resolution, consistency checks, or persistence.
---

# Validating boxscore ingestion

Treat the [FIBA model](../../../docs/plan/MODELO-BOXSCORE-FIBA.md) and [Basketball Site model](../../../docs/plan/MODELO-BOXSCORE-SITE.md) as the supported contracts. Follow the import boundaries in [AGENTS.md](../../../AGENTS.md).

Read [contract-fixture-test-matrix.md](references/contract-fixture-test-matrix.md) and select the affected fixtures and tests.

## Workflow

1. Identify the exact supported format and preserve the original PDF bytes through extraction and private upload.
2. Validate document identity, teams, players, jerseys, periods, totals, negative values, merged cells, and format-specific geometry.
3. Reconcile player rows, team totals, period scores, and final score. Missing data is not zero.
4. Apply the current matching contract. Basketball Site abbreviations may be preselected only by the unique permitted combination; ambiguity requires explicit review.
5. Keep team resolution and any creation explicit and authoritative. Do not create games or matchups implicitly.
6. Review transactionality, idempotency, divergent retry behavior, concurrency, audit, private storage, and stable errors.
7. Run focal parser, extraction, matching, route, and pgTAP tests before the consolidated gate.
8. Produce `SKILL_RESULT` from the agent contract.

Do not add OCR, a generic parser, or full official scoresheet ingestion under this skill.
