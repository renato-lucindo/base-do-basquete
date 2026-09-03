# Prompt de retomada

Continue autonomamente a PR #35 pelo plano acelerado.

Leia integralmente `AGENTS.md`, `HANDOFF.md` e `docs/plan/acelerado-mvp/README.md` na ordem indicada. Reconcilie branch, PR, checks, preview e migrations. Escolha o primeiro pacote `READY` em `02-FILA-ACELERADA.md`; os cartões antigos são critérios internos e não devem gerar ciclos separados de CI.

Priorize o caminho completo do MVP. Não implemente item pós-MVP antes de ele ser necessário para desbloquear o caminho crítico. Preserve histórico, migrations enviadas, colunas legadas, MFA, AAL2, RLS, transações, idempotência, auditoria, PDFs privados e o formato FIBA/Genius Sports único.

Execute testes focais durante o trabalho e um gate completo ao final do pacote. Faça commits coerentes e pushes somente na branch da PR #35. Não faça merge ou produção sem o gate e a autorização aplicável. Atualize o HANDOFF com evidências e o próximo pacote exato.
