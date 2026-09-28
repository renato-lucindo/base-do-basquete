---
name: investigating-base-performance
description: Investigate Base do Basquete performance regressions. Use when public benchmarks, SQL latency, cache behavior, payload size, redirects, or Cloudflare Worker execution miss an established target.
---

# Investigating Base do Basquete performance

Start from the current benchmark implementation and targets in `scripts/benchmark-public.mjs`. Keep diagnosis separate from implementation.

Read [diagnostic-tree.md](references/diagnostic-tree.md) and follow the first branch supported by evidence.

## Workflow

1. Record environment, commit, route, sample count, warmups, response status, redirects, payload, and cache conditions.
2. Establish a repeatable baseline. Compare p50 and p95 under equivalent conditions; one request is not a regression proof.
3. Test hypotheses in order of cheapest discrimination.
4. Inspect SQL plans only on safe read queries and an appropriate environment.
5. Propose the smallest change tied to the measured cause, then compare candidate and baseline.
6. Preserve current targets unless a separately authorized product decision changes them.
7. Produce `SKILL_RESULT` plus the investigator report defined in `.agents/performance-investigator.md`.

Production benchmarking remains blocked by default. Use the repository's explicit opt-in only when the work unit authorizes production measurement.
