# HANDOFF — Base do Basquete

> Checkpoint operacional para retomada. Histórico detalhado pertence ao Git, às PRs e a `docs/execution/`; não registre segredos aqui.

## 1. Estado vigente

A unidade ativa é `MANUAL-SCORESHEET-V2-FIBA2024`, na branch `codex/manual-scoresheet-v2` e PR draft #72. O objetivo é implementar a súmula manual v2 para transcrição pós-jogo em desktop, com criação transacional do jogo somente na confirmação, roster/estrelas/capitão/equipe técnica, oficiais, entrada rápida de pontos e faltas FIBA 2024, revisão versionada com concorrência otimista, rascunho local e acessibilidade por teclado.

A branch foi aberta originalmente em `b663b7acf1be3ce5463468a17613ae983bbe5a26` e foi reconciliada com `origin/main@8ac62209a636be757d96270eef9dc6b27c8735c0` pelo merge `6beb49c`, que integrou a governança documental da PR #71. O conflito ficou restrito a este arquivo; a resolução adotou o novo formato compacto do handoff.

## 2. WRITE_LOCK

```text
WRITE_LOCK:
OWNER: project-maintainer
WORK_UNIT: MANUAL-SCORESHEET-V2-FIBA2024
BRANCH: codex/manual-scoresheet-v2
BASE_COMMIT: 8ac62209a636be757d96270eef9dc6b27c8735c0
HEAD_FUNCIONAL: 0ba4d1ce1da33f9298573bb449d7d9311691e324
SCOPE: súmula manual v2, domínio FIBA 2024, persistência aditiva, criação/revisão transacional, wizard e lançamento rápido, testes e documentação da mesma PR
SCOPE_NEGATIVO: sem criação de atleta pela súmula, OCR/parser genérico, alteração dos contratos de importação PDF, conflito com boxscore, Supabase compartilhado, merge final ou produção nesta unidade
REQUIRED_REVIEWERS: database-security-reviewer, accessibility-ui-reviewer, qa-reviewer
STATUS: ACTIVE
```

`statistics-domain-reviewer` será acrescentado somente se etapas posteriores alterarem fórmulas, projeções, agregações ou isolamento estatístico além do armazenamento semântico previsto.

## 3. Checkpoints concluídos

- Etapa 0 — commit `70c003e`: plano retomável portado para `docs/plan/sumula-manual-v2/`, editor/rascunho fixado em `v2` e contrato de `localStorage` preservado.
- Etapa 1 — commit `f5e5757`: domínio puro FIBA 2024 com tipo semântico separado da penalidade, `U2`, `C1`/`B1`, GD por `D`/`2T`/`2U`/`T+U` e bloqueio de nova falta de atleta após GD. Teste focal: 44/44 verdes; Biome focal e `git diff --check` verdes.
- Etapa 2 — commit `0ba4d1c`: persistência aditiva para faltas semânticas, comissão técnica e oficiais; compatibilidade com inserts legados; RLS/grants das novas tabelas; pgTAP focal versionado. Teste de domínio 44/44 verde; Biome focal e `git diff --check` verdes.

O `npm run typecheck` da Etapa 2 falhou apenas pelos dois erros já existentes no WIP posterior da rota da súmula: `ScoresheetRevisionState` ainda não exportado pelo editor e prop `revision` ainda não declarada em `ManualScoresheetEditorProps`. Não houve erro novo nos artefatos da Etapa 2.

## 4. Bloqueio do checkpoint atual

A Etapa 2 ainda não está autorizada a avançar. Este host não possui Docker nem Podman, portanto `supabase db reset` e pgTAP não podem ser executados localmente. O checkpoint exige CI descartável comprovando banco desde zero, compatibilidade de upgrade e a suíte `supabase/tests/database/manual_scoresheet_v2_persistence.test.sql`.

Não usar o Supabase compartilhado para suprir essa validação. Se o CI SQL falhar, corrigir a Etapa 2 e repetir o checkpoint antes de iniciar a Etapa 3.

## 5. WIP preservado

Antes da reconciliação com `main`, o WIP de etapas posteriores foi guardado no stash `manual-scoresheet-v2-wip-before-main-reconcile` e depois reaplicado sem conflito. A igualdade foi confirmada pelo SHA-256 `8E4F9F0A7033AB5E028E80D96BA4DB5C5D04AB5E760C9BA4F4154D43292CFFDB` tanto para o patch atual quanto para o patch preservado no stash. O stash permanece como backup até o checkpoint SQL ficar verde. O WIP restaurado contém alterações em:

- `app/modules/observability/operation.server.ts`;
- `app/modules/scoresheet/compact-grid.tsx`;
- `app/routes/admin.competitions.$competitionId.scoresheets.new.test.ts`;
- `app/routes/admin.competitions.$competitionId.scoresheets.new.tsx`;
- `app/types/database.generated.ts`.

Backup adicional do SQL completo do WIP: `C:\Users\12405304716\AppData\Local\Temp\manual_scoresheet_v2_full_wip.sql` (51.316 bytes, registrado em 07/10/2026 14:13:58). Preservar ambos até a restauração e comparação pós-merge.

## 6. GitHub e ambientes

- PR draft: #72 — `feat: manual scoresheet v2 FIBA 2024`.
- Head remoto antes desta reconciliação: `0ba4d1ce1da33f9298573bb449d7d9311691e324`.
- Antes da reconciliação, a PR estava `mergeable=false` porque `main` avançou até `8ac6220`; não havia checks associados ao head anterior. A branch local agora contém o merge `6beb49c` e aguarda push para atualizar a PR e disparar os checks.
- Supabase compartilhado: não alterado por esta unidade.
- Cloudflare preview/produção: não alterados por esta unidade.
- Produção: nenhuma ação autorizada ou executada nesta unidade.

## 7. Riscos e pontos de atenção

- Confirmar no PostgreSQL real o nome esperado da constraint `game_officials_role_check` usada no pgTAP.
- Reavaliar se `linked_captain_roster_entry_id` precisa de garantia estrutural adicional de que o roster entry é o capitão do jogo; caso não fique no schema, a Etapa 3 deve validar isso autoritativamente no writer.
- C1/B1 devem persistir semanticamente como `foul_type='T'`, `penalty_ft_count=1` e `original_notation` preservada; o legado `foul_code` pode continuar `T`.
- Não iniciar interface ou writer v2 antes do checkpoint SQL da Etapa 2 ficar verde.

## 8. Próximo passo exato

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: branch codex/manual-scoresheet-v2 / PR #72 / workflow de banco descartável
ACAO: publicar a branch reconciliada e validar migrations do zero, upgrade e pgTAP da Etapa 2 no CI; corrigir qualquer falha antes de abrir a Etapa 3
CRITERIO_DE_CONCLUSAO: PR #72 sem conflito, WIP restaurado sem perda e checkpoint SQL da Etapa 2 verde no mesmo HEAD; somente então iniciar docs/plan/sumula-manual-v2/03-criacao-transacional-jogo-sumula.md
```

## 9. Referências de retomada

- Plano da unidade: `docs/plan/sumula-manual-v2/README.md`.
- Etapa atual: `docs/plan/sumula-manual-v2/02-persistencia-aditiva.md`.
- Próxima etapa condicionada: `docs/plan/sumula-manual-v2/03-criacao-transacional-jogo-sumula.md`.
- Estado anterior completo do handoff: recuperável no histórico Git em `b663b7a:HANDOFF.md`.

Ao fechar cada etapa, mantenha este arquivo conciso e registre a evidência detalhada na PR ou em `docs/execution/`.
