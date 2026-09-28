# Performance diagnostic tree

The current public targets are p50 at or below 1,000 ms and p95 at or below 1,500 ms. Read the script for the current route list.

1. **Response invalid or redirect present**
   - Confirm canonical route, status, redirect policy, body, and environment routing before measuring latency.
2. **Payload or rendering changed**
   - Compare response bytes, serialization work, duplicated data, and client/server boundaries.
3. **Cache behavior differs**
   - Compare cold and warm paths, cache key dimensions, invalidation, and headers.
4. **Remote/database time dominates**
   - Trace query count, sequential calls, returned rows, indexes, plans, and authoritative filters.
5. **Worker processing dominates**
   - Inspect parsing, aggregation, repeated computation, logging, and blocking work.
6. **Tail latency only**
   - Increase comparable samples, inspect outliers and external variance, and avoid optimizing a single observation.

Evidence must include raw benchmark JSON or equivalent measurements, not only a narrative conclusion.
