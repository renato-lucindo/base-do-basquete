# Database review checklist

Use only sections touched by the delta.

## Migration and integrity

- Compare migration history with the target environment; do not edit an applied file.
- Check forward compatibility, failure atomicity, constraints, foreign keys, supporting indexes, and seed compatibility.
- Preserve canonical identifiers, hashes, historical facts, and private fields unless the work unit explicitly changes them.

## Authorization and privacy

- Verify RLS is enabled for exposed tables and test anonymous, unauthorized authenticated, AAL1, and authorized AAL2 access where relevant.
- Inspect grants, schema `USAGE`, function `EXECUTE`, ownership, `SECURITY DEFINER`, and safe `search_path`.
- Keep authorization server-side and independent of `user_metadata`.
- Ensure private data is absent from public views, DTOs, logs, audit payloads, and browser bundles.

## Critical writes

- Validate inputs and authority inside the transaction.
- Check idempotency identity, divergent retries, concurrency, partial failure, audit, and stable domain errors.
- Confirm the frontend cannot bypass the authoritative RPC or server boundary.

## Evidence

- Focal pgTAP while iterating; complete `supabase test db --local` at the database gate.
- Disposable database or rollback transaction for migration trials.
- Generated types, advisors, reconciliation, inventory, and secret scan when applicable.
