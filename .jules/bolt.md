## 2025-03-03 - N+1 Bottlenecks in Organization API
**Learning:** `Promise.all` + `.map()` executing iterative Postgres `LIMIT N` queries creates silent performance killers in Node APIs serving dashboard resources.
**Action:** When gathering fixed limits of sub-resources (like 5 latest VPSs per organization), use `WHERE org_id = ANY($1)` with a `ROW_NUMBER() OVER (PARTITION BY org_id ORDER BY created_at DESC)` subquery to batch them into a single roundtrip, then restructure into O(1) Maps in memory.
