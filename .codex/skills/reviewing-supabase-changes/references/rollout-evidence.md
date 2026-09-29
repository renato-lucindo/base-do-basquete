# Rollout evidence

Use this reference only for migration or database release work.

Record:

- exact branch, base, reviewed commit, migration names, and target environment;
- preflight migration state and authoritative inventory;
- disposable or rollback trial result;
- focal and complete pgTAP results;
- grants, RLS, policies, RPC execution rights, and advisors;
- before/after reconciliation for affected domain facts;
- type-generation result and application compatibility order;
- rollback or recovery path;
- post-apply checks and any authenticated smoke evidence.

Application and migration order must support the deployed versions that can coexist during rollout. A green local test does not prove the shared environment matches the reviewed commit.
