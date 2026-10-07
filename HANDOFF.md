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
HEAD_FUNCIONAL: e9da09ac2cb8d412ec0f91d73f3120e278154362
SCOPE: súmula manual v2, domínio FIBA 2024, persistência aditiva, criação/revisão transacional, wizard e lançamento rápido, testes e documentação da mesma PR
SCOPE_NEGATIVO: sem criação de atleta pela súmula, OCR/parser genérico, alteração dos contratos de importação PDF, conflito com boxscore, Supabase compartilhado, merge final ou produção nesta unidade
REQUIRED_REVIEWERS: database-security-reviewer, accessibility-ui-reviewer, qa-reviewer
STATUS: ACTIVE
```

`statistics-domain-reviewer` será acrescentado somente se etapas posteriores alterarem fórmulas, projeções, agregações ou isolamento estatístico além do armazenamento semântico previsto.

## 3. Checkpoints concluídos

- Etapa 0 — commit `70c003e`: plano retomável portado para `docs/plan/sumula-manual-v2/`, editor/rascunho fixado em `v2` e contrato de `localStorage` preservado.
- Etapa 1 — commit `f5e5757`: domínio puro FIBA 2024 com tipo semântico separado da penalidade, `U2`, `C1`/`B1`, GD por `D`/`2T`/`2U`/`T+U` e bloqueio de nova falta de atleta após GD. Teste focal: 44/44 verdes; Biome focal e `git diff --check` verdes.
- Etapa 2 — commit `0ba4d1c`: persistência aditiva para faltas semânticas, comissão técnica e oficiais; compatibilidade com inserts legados; RLS/grants das novas tabelas; pgTAP focal versionado. Teste de domínio 44/44 verde; Biome focal e `git diff --check` verdes. O workflow descartável `37671645385` concluiu gate, database e accessibility em verde, incluindo banco desde zero, pgTAP e prova de concorrência.

O `npm run typecheck` da Etapa 2 falhou apenas pelos dois erros já existentes no WIP posterior da rota da súmula: `ScoresheetRevisionState` ainda não exportado pelo editor e prop `revision` ainda não declarada em `ManualScoresheetEditorProps`. Não houve erro novo nos artefatos da Etapa 2.

## 4. Checkpoint atual — Etapa 3

A Etapa 3 está ativa em `docs/plan/sumula-manual-v2/03-criacao-transacional-jogo-sumula.md`. O delta local adiciona `supabase/migrations/20261007161000_manual_scoresheet_v2_atomic_create.sql` e `supabase/tests/database/manual_scoresheet_v2_atomic_create.test.sql` para criar matchup, jogo e súmula em uma única transação, com idempotência, rollback total, validação de registrations, persistência do payload e RLS.

O commit funcional da Etapa 3 é `c03515b`, seguido da correção focal `e9da09a` para remover do pgTAP uma consulta à coluna inexistente `game_data_domain_authority.valid_to`. No HEAD funcional `e9da09a`, o workflow CI `37677320985` ficou verde em `gate`, `database` e `accessibility`; o job de banco comprovou migrations/seed do zero, compatibilidade de upgrade, suíte pgTAP e as verificações de concorrência. Os workflows `Pull request preview` `37677320940` e `CodeQL` `37677320958` também ficaram verdes.

Validações locais: `git diff --check` verde, `npm run docs:inventory` verde, 29 assertions compatíveis com `plan(29)` e `npm run scan:secrets` verde para 699 arquivos rastreados. O `REVIEW_PACKET` está publicado na PR #72 e atualizado para `e9da09a`. `database_security_reviewer` e `accessibility_ui_reviewer` foram acionados no commit correto, mas a recuperação dos pareceres pelo coordenador foi bloqueada pelo runtime com a mensagem de que não foi possível determinar o status de segurança da espera. Não atribuir aprovação sem o parecer recuperado; `qa-reviewer` permanece pendente até os pareceres especialistas válidos estarem disponíveis.

## 5. WIP preservado

Antes da reconciliação com `main`, o WIP de etapas posteriores foi guardado no stash `manual-scoresheet-v2-wip-before-main-reconcile` e depois reaplicado sem conflito. A igualdade foi confirmada pelo SHA-256 `8E4F9F0A7033AB5E028E80D96BA4DB5C5D04AB5E760C9BA4F4154D43292CFFDB` tanto para o patch atual quanto para o patch preservado no stash. O stash permanece como backup durante a Etapa 3. O WIP restaurado contém alterações em:

- `app/modules/observability/operation.server.ts`;
- `app/modules/scoresheet/compact-grid.tsx`;
- `app/routes/admin.competitions.$competitionId.scoresheets.new.test.ts`;
- `app/routes/admin.competitions.$competitionId.scoresheets.new.tsx`;
- `app/types/database.generated.ts`.

Backup adicional do SQL completo do WIP: `C:\Users\12405304716\AppData\Local\Temp\manual_scoresheet_v2_full_wip.sql` (51.316 bytes, registrado em 07/10/2026 14:13:58). Preservar ambos até a restauração e comparação pós-merge.

## 6. GitHub e ambientes

- PR draft: #72 — `feat: manual scoresheet v2 FIBA 2024`.
- HEAD funcional local/remoto da Etapa 3: `e9da09ac2cb8d412ec0f91d73f3120e278154362` antes deste checkpoint documental.
- CI `37677320985`, preview `37677320940` e CodeQL `37677320958` estão verdes para o HEAD funcional; a PR permanece aberta e draft.
- Supabase compartilhado: não alterado por esta unidade.
- Preview da PR: workflow verde; produção não alterada.
- Produção: nenhuma ação autorizada ou executada nesta unidade.

## 7. Riscos e pontos de atenção

- A Etapa 3 valida autoritativamente o capitão antes de persistir `linked_captain_roster_entry_id`; preservar esse contrato ao corrigir eventuais falhas de CI.
- C1/B1 devem persistir semanticamente como `foul_type='T'`, `penalty_ft_count=1` e `original_notation` preservada; o legado `foul_code` pode continuar `T`.
- Não iniciar a Etapa 4 até recuperar pareceres válidos de `database-security-reviewer` e `accessibility-ui-reviewer` e obter `qa-reviewer` no mesmo HEAD material; não simular aprovação enquanto o runtime de coordenação permanecer bloqueado.

## 8. Próximo passo exato

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: PR #72 / REVIEW_PACKET / revisores especializados da WORK_UNIT MANUAL-SCORESHEET-V2-FIBA2024
ACAO: recuperar ou renovar pareceres read-only de `database-security-reviewer` e `accessibility-ui-reviewer` para o HEAD funcional `e9da09a` ou para um checkpoint posterior exclusivamente documental; depois acionar `qa-reviewer` usando as evidências verdes do CI `37677320985`; atualizar o handoff apenas com pareceres efetivamente recebidos
CRITERIO_DE_CONCLUSAO: pareceres obrigatórios válidos e sem bloqueios, associados ao mesmo HEAD material da Etapa 3; somente então registrar a Etapa 3 como concluída e iniciar a Etapa 4
```

## 9. Referências de retomada

- Plano da unidade: `docs/plan/sumula-manual-v2/README.md`.
- Etapa atual: `docs/plan/sumula-manual-v2/03-criacao-transacional-jogo-sumula.md`.
- Próxima etapa condicionada: Etapa 4, somente após o checkpoint técnico já verde ser complementado pelos pareceres obrigatórios válidos.
- Estado anterior completo do handoff: recuperável no histórico Git em `b663b7a:HANDOFF.md`.

Ao fechar cada etapa, mantenha este arquivo conciso e registre a evidência detalhada na PR ou em `docs/execution/`.
