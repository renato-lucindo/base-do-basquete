---
name: validating-basketball-statistics
description: Implement or validate Base do Basquete basketball calculations. Use when changing formulas, aggregation, public statistical read models, game statistics, player profiles, denominators, or historical isolation.
---

# Validating basketball statistics

Use the current requirements, domain code, SQL contracts, and tests as the authority for each metric. Do not infer a formula from a label or UI alone.

Read [statistics-invariants.md](references/statistics-invariants.md) and select only the affected paths.

## Workflow

1. Trace each changed metric from authoritative game/submission data through aggregation and presentation.
2. Define numerator, denominator, eligibility, grouping dimensions, and publication state.
3. Distinguish missing, zero, DNP, disqualified, and negative values that are valid for the metric.
4. Preserve isolation by competition, edition, category, gender division, team, game, source authority, and published version.
5. Compare TypeScript domain logic, server query/read model, SQL, caching, and UI formatting.
6. Verify invalidation when a write changes a public aggregate.
7. Run affected statistics tests and SQL tests; run the SQL or public benchmark only when the changed path warrants it.
8. Produce `SKILL_RESULT` from the agent contract.

Do not manufacture advanced metrics from incomplete manual data or convert unknown attempts into zero.
