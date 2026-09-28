# Statistics invariants

## Source and isolation

- Resolve active authority and publication state before aggregation.
- Never mix competitions, editions, categories, gender divisions, teams, or contexts in a cache key or aggregate.
- Draft, superseded, withdrawn, or otherwise non-authoritative data must not enter public totals.

## Participation and denominators

- DNP does not increment games played.
- Missing attempts do not produce fabricated percentages.
- Zero is valid only when the source explicitly establishes zero.
- Overtime and negative plus/minus values must survive aggregation where supported.

## Consistency

- Player points, team totals, periods, and final scores must reconcile under the applicable source contract.
- Total and per-game views must share the same eligible game set.
- UI formatting must not change the stored or calculated meaning.

## Focal areas

- `app/modules/statistics/` domain and server tests;
- `app/components/game-statistics.test.tsx` and `statistics-explorer.test.tsx`;
- `supabase/tests/database/public_game_statistics.test.sql`;
- `supabase/benchmarks/statistics_benchmark.sql` when query shape or scale changes.
