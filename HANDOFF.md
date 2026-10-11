# HANDOFF — Base do Basquete

> Checkpoint operacional para retomada. Histórico detalhado pertence ao Git, às PRs e a `docs/execution/`; não registre segredos aqui.

## 1. Estado vigente

**Checkpoint atual (10/10/2026): pendências estatísticas P1/P2 e republicação corrigidas; Etapa 4 backend aprovada e verificada no artefato 86934cc. PR #72 permanece draft, sem migrations no Supabase compartilhado, merge ou início da Etapa 5.**

A unidade ativa é `MANUAL-SCORESHEET-V2-FIBA2024`, na branch `codex/manual-scoresheet-v2` e PR draft #72. O objetivo é implementar a súmula manual v2 para transcrição pós-jogo em desktop, com criação transacional do jogo somente na confirmação, roster/estrelas/capitão/equipe técnica, oficiais, entrada rápida de pontos e faltas FIBA 2024, revisão versionada com concorrência otimista, rascunho local e acessibilidade por teclado.

A branch foi aberta originalmente em `b663b7acf1be3ce5463468a17613ae983bbe5a26` e foi reconciliada com `origin/main@8ac62209a636be757d96270eef9dc6b27c8735c0` pelo merge `6beb49c`, que integrou a governança documental da PR #71. O conflito ficou restrito a este arquivo; a resolução adotou o novo formato compacto do handoff.

## 2. WRITE_LOCK

```text
WRITE_LOCK:
OWNER: project-maintainer
WORK_UNIT: MANUAL-SCORESHEET-V2-FIBA2024
BRANCH: codex/manual-stage4-v3-review (worktree local; upstream origin/codex/manual-scoresheet-v2, PR #72)
BASE_COMMIT: 27d917a1ce4a404ced091fd3ca660113c215ca92
HEAD_COMMIT: 86934cc16d8c4662f2a07e30868b6e10eea47c0a (artefato revisado; o commit desta seção 22 é exclusivamente documental, consultar Git)
HEAD_FUNCIONAL: 86934cc16d8c4662f2a07e30868b6e10eea47c0a (gates verdes e pareceres renovados; Etapa 4 concluída tecnicamente)
SCOPE: súmula manual v2, domínio FIBA 2024, persistência aditiva, criação/revisão transacional, wizard e lançamento rápido, testes e documentação da mesma PR
SCOPE_NEGATIVO: sem criação de atleta pela súmula, OCR/parser genérico, alteração dos contratos de importação PDF, conflito com boxscore, Supabase compartilhado, merge final ou produção nesta unidade
REQUIRED_REVIEWERS: database-security-reviewer, statistics-domain-reviewer, accessibility-ui-reviewer, qa-reviewer
STATUS: RELEASED (checkpoint da Etapa 4 entregue; retomar explicitamente antes de nova escrita)
```

`statistics-domain-reviewer` está previsto por envolver projeções e isolamento estatístico. Os bloqueios estatístico e de QA da Etapa 4 foram expressamente revogados no artefato 86934cc; veja seção 22. PR permanece draft, com Etapas 5–10 fora deste checkpoint.

## 3. Checkpoints concluídos

- Etapa 0 — commit `70c003e`: plano retomável portado para `docs/plan/sumula-manual-v2/`, editor/rascunho fixado em `v2` e contrato de `localStorage` preservado.
- Etapa 1 — commit `f5e5757`: domínio puro FIBA 2024 com tipo semântico separado da penalidade, `U2`, `C1`/`B1`, GD por `D`/`2T`/`2U`/`T+U` e bloqueio de nova falta de atleta após GD. Teste focal: 44/44 verdes; Biome focal e `git diff --check` verdes.
- Etapa 2 — commit `0ba4d1c`: persistência aditiva para faltas semânticas, comissão técnica e oficiais; compatibilidade com inserts legados; RLS/grants das novas tabelas; pgTAP focal versionado. Teste de domínio 44/44 verde; Biome focal e `git diff --check` verdes. O workflow descartável `37671645385` concluiu gate, database e accessibility em verde, incluindo banco desde zero, pgTAP e prova de concorrência.
- Etapa 3 — commits `c03515b` + `e9da09a`, checkpoint documental `be0036d`: criação atômica de matchup + jogo + súmula, idempotência, rollback total, snapshot imutável, RLS/AAL2 e autoridades de domínio. CI `37677320985`, preview `37677320940` e CodeQL `37677320958` verdes. Pareceres finais: `database-security-reviewer` APPROVE em `be0036d`; `accessibility-ui-reviewer` APPROVE no HEAD funcional `e9da09a`, com delta posterior exclusivamente documental validado no gate incremental; `qa-reviewer` APPROVE em `be0036d`, autorizando encerrar a Etapa 3 e iniciar a Etapa 4.

O `npm run typecheck` da Etapa 2 falhou apenas pelos dois erros já existentes no WIP posterior da rota da súmula: `ScoresheetRevisionState` ainda não exportado pelo editor e prop `revision` ainda não declarada em `ManualScoresheetEditorProps`. Não houve erro novo nos artefatos da Etapa 2.

## 4. Checkpoint atual — Etapa 4

A Etapa 3 está encerrada. O gate final incremental do checkpoint `be0036d` recebeu `APPROVE` de `database-security-reviewer` e `qa-reviewer`, sem achados bloqueantes; o parecer de acessibilidade do HEAD funcional `e9da09a` permaneceu aplicável porque `be0036d` altera somente este handoff, e o QA validou explicitamente esse delta documental. As evidências materiais continuam sendo CI `37677320985`, preview `37677320940` e CodeQL `37677320958`, todos verdes.

A Etapa 4 está ativa em `docs/plan/sumula-manual-v2/04-revisoes-e-auditoria-backend.md`. O objetivo é criar revisões auditáveis da súmula salva com controle de concorrência e snapshots imutáveis: RPC separada de revisão, `baseSubmissionId/hash`, motivo obrigatório, nova versão sem mutar snapshots anteriores, autor/data/diff, rejeição de revisão desatualizada e cálculo correto dos LL de penalidade concedidos/recebidos. O checkpoint deve permanecer backend-only até revisão e concorrência estarem cobertas por testes.

**Decisão de negócio documentada em 08/10/2026:** todos os LL concedidos nas penalidades são efetivamente cobrados. `P` = 0 LL; `P3` = 3; `T1` = 1; `U2` = uma falta U com 2 LL. LL cedidos de uma equipe são a soma das penalidades de suas faltas; LL cobrados são a soma das faltas adversárias; LL convertidos são os acertos de 1 ponto de seus atletas; LL desperdiçados = cobrados − convertidos. O único aproveitamento da súmula manual será **LL% coletivo da equipe**, se cobrados > 0, sem permitir convertidos > cobrados. Zero cobranças implica percentual indisponível. Não há tentativas individuais, LL% individual ou aproveitamento de 2P/3P/geral. A regra deve preservar os boxscores avançados. Aplicada exclusivamente ao **planejamento**, nos arquivos `PLANO-SUMULA-MANUAL-V2.md`, `docs/plan/sumula-manual-v2/README.md`, nas Etapas 1, 2, 4, 7, 8, 9, 10 e em `docs/plan/PLANO-MESTRE-PR-FONTES-DE-DADOS-E-JOGADORES.md`; implementação/testes de código continuam pendentes.

Foi implementada a migration `20261008090000_manual_scoresheet_v2_revisions.sql` e o pgTAP `manual_scoresheet_v2_revisions.test.sql` em `bff263c`, com correções nos testes em `7b79b6f` e `d10d048`. O CI `37780280225` do commit `d10d048` terminou verde: database, gate e accessibility; pgTAP completo com 44 arquivos e 1211 asserções, incluindo as 39 de revisão. CodeQL `37780280231` também passou. A descrição da PR #72 contém o REVIEW_PACKET com esse HEAD remoto e as evidências.

Após parecer estatístico `BLOCK_RELEASE`, foi acrescentado o cenário bilateral de LL no teste pgTAP pelo commit `a14d3fc29e90dd3ea276eadd2eb820731617e1df`. O commit documental posterior `39fa5be81ddb600bcd46471b5dba12fe9e448ca0` é o HEAD local confirmado em 08/10/2026. O histórico de recusa anterior de push deve ser mantido como evidência histórica; o status local atual não indica divergência com `origin/codex/manual-scoresheet-v2`, mas não houve novo `fetch` nem validação de CI nesta sessão.

Revisão estatística no `d10d048`: fórmula semântica de LL considerada coerente, porém parecer `BLOCK_RELEASE` por impossibilidade de inspecionar os modelos públicos e confirmar a ausência de percentuais derivados de `free_throw_attempted` desconhecido. A inspeção foi recusada novamente pela ferramenta após autorização explícita do usuário; não houve contorno. Os dois agentes de segurança de banco falharam por indisponibilidade de capacidade do modelo e não emitiram parecer. O QA final ainda não foi acionado. A Etapa 4 **não está encerrada**.

## 4.1. Implementação parcial da Etapa 4 — LL coletivo

Foi adicionada a regra estatística de domínio para a súmula manual: LL cobrados, cedidos e convertidos são tratados como totais coletivos, sem criação de tentativas individuais. A função manualScoresheetFreeThrowSummary valida convertidos <= cobrados, calcula desperdiçados e retorna percentual 
ull quando não existem cobranças. Teste focal executado: 
pm test -- app/modules/statistics/domain.test.ts (12 testes verdes).

Esta alteração ainda não encerra a Etapa 4. Permanecem pendentes a integração completa com projeções públicas, validações transacionais de revisão, pareceres especializados e QA final.

Foi criada a migration aditiva `20261008140000_manual_scoresheet_v2_collective_ft_public_projection.sql`. Ela adiciona uma barreira transacional para impedir que submissões manuais criem tentativas artificiais em `player_period_stats`, publica uma projeção coletiva de LL e mantém os cálculos de tentativas dos boxscores importados isolados. O teste focal executado nesta sessão foi `npm test -- app/modules/statistics/domain.test.ts` (12/12 verdes). Ainda faltam pgTAP focal da nova migration, gates consolidados e pareceres especializados.

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
- HEAD local e referência local de tracking da branch em 08/10/2026: `39fa5be81ddb600bcd46471b5dba12fe9e448ca0` (`git status` sem ahead/behind). O último CI comprovadamente verde permanece vinculado a `d10d048922525eb06d5b14152469170359d7d994`; não foi comprovado novo CI para `a14d3fc` ou `39fa5be` nesta sessão.
- CI remoto `37780280225` e CodeQL `37780280231` verdes no `d10d048`; o teste bilateral local ainda não foi validado. A PR permanece aberta e draft.
- Supabase compartilhado: não alterado por esta unidade.
- Preview da PR: workflow verde; produção não alterada.
- Produção: nenhuma ação autorizada ou executada nesta unidade.

## 7. Riscos e pontos de atenção

- A Etapa 3 valida autoritativamente o capitão antes de persistir `linked_captain_roster_entry_id`; preservar esse contrato ao corrigir eventuais falhas de CI.
- C1/B1 devem persistir semanticamente como `foul_type='T'`, `penalty_ft_count=1` e `original_notation` preservada; o legado `foul_code` pode continuar `T`.
- A Etapa 4 deve preservar mandante/visitante e snapshots anteriores, rejeitar revisão concorrente desatualizada e manter motivo/autor/data/diff auditáveis.
- `BLOCK_RELEASE` estatístico em `d10d048`: verificar a exposição de tentativas de lance livre não informadas em read models públicos; essa inspeção foi recusada pela ferramenta duas vezes. A cobertura bilateral foi adicionada localmente mas depende de CI.
- Database/security reviewer falhou por capacidade do modelo nas tentativas anteriores; nenhum APPROVE válido da Etapa 4. Gate de QA segue pendente.
- Uma tentativa anterior de push do commit bilateral foi recusada pela revisão automática da ferramenta; não houve novo push nesta reconciliação. Inspecionar a situação atual antes de eventual envio futuro.
- Os cinco arquivos WIP posteriores continuam fora dos commits até serem reconciliados explicitamente com o escopo da etapa correspondente.
- Em 08/10/2026, a documentação do plano foi modificada localmente. `git diff --check` passou; nenhuma migration, código, Supabase, CI, preview ou produção foi executado/alterado para aplicar essa regra. As cinco alterações WIP anteriores foram mantidas, sem alterações pela atualização documental. Planejamento não equivale a implementação.

## 8. Próximo passo exato

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: `docs/plan/sumula-manual-v2/04-revisoes-e-auditoria-backend.md`, código e testes afetados da Súmula Manual V2, branch `codex/manual-scoresheet-v2`, PR #72
ACAO: adicionar pgTAP para a migration `20261008140000_manual_scoresheet_v2_collective_ft_public_projection.sql`, integrar a publicação versionada ao fluxo de revisão transacional e verificar read models públicos para impedir percentuais artificiais. Preservar os cinco arquivos WIP, validar testes focais/pgTAP e conferir CI no HEAD efetivo antes de atualizar REVIEW_PACKET. Obter pareceres válidos de database-security-reviewer e statistics-domain-reviewer, resolver o BLOCK_RELEASE e somente então acionar qa-reviewer.
CRITERIO_DE_CONCLUSAO: comportamento estatístico fiel ao plano e comprovado por testes e CI, sem criar tentativas individuais ou regressão de boxscore; pareceres de segurança/estatística/QA válidos e concorrência/snapshots preservados. Não iniciar Etapa 5 antes de encerrar a Etapa 4.
```

## 9. Referências de retomada

- Plano da unidade: `docs/plan/sumula-manual-v2/README.md`.
- Etapa concluída: `docs/plan/sumula-manual-v2/03-criacao-transacional-jogo-sumula.md`.
- Etapa atual: `docs/plan/sumula-manual-v2/04-revisoes-e-auditoria-backend.md`.
- Estado anterior completo do handoff: recuperável no histórico Git em `b663b7a:HANDOFF.md`.

Ao fechar cada etapa, mantenha este arquivo conciso e registre a evidência detalhada na PR ou em `docs/execution/`.


## 10. Reconciliação operacional e validação isolada — 08/10/2026

- Banco remoto `yjnbemfeyjhxhomprlnm` (consultado apenas em leitura): 62 migrations aplicadas, última `20261005140504_edition_creation_workflow`, nenhuma migration da súmula manual v2. Sem `repair`, DDL, DML ou deploy no Supabase compartilhado.
- Comparação das 69 migrations da branch: 54 timestamps divergentes, 3 nomes remotos ausentes localmente e 10 arquivos locais sem registro remoto; 56 SQL iguais por nome, divergências reais em `canonical_model` e formato diferente em `basketball_site_boxscore`; `wp14_import_team_stats_assisted_players` sem statements remotos. A reconciliação definitiva do histórico segue pendente.
- `scripts/supabase-stage4-reconcile-overlay.mjs` construiu overlay temporário com 62 versões registradas + 4 migrations novas. **Dry-run real informado pelo usuário em Windows:** `npx.cmd supabase --workdir "<pasta-temporaria>" db push --project-ref yjnbemfeyjhxhomprlnm --dry-run` listou apenas `20261006223000_manual_scoresheet_v2.sql`, `20261007161000_manual_scoresheet_v2_atomic_create.sql`, `20261008090000_manual_scoresheet_v2_revisions.sql` e `20261008140000_manual_scoresheet_v2_collective_ft_public_projection.sql`, sem aplicar alterações.
- **Validação isolada comprovada no GitHub Actions**: CI run [37819623694](https://github.com/renato-lucindo/base-do-basquete/actions/runs/37819623694), commit funcional/documental `2992c7bc`: PostgreSQL descartável do zero recebeu as quatro migrations sem erro; `supabase test db --local` PASS, **45 arquivos e 1.220 asserções**, incluindo os quatro testes pgTAP da súmula manual v2. Run `database` validou também upgrade de agendamento e concorrência de presets/boxscore. `gate` (formatação, lint, typecheck, testes JS, build, varredura de segredos) e `accessibility` PASS. CodeQL run [37819623706](https://github.com/renato-lucindo/base-do-basquete/actions/runs/37819623706) e preview run [37819623679](https://github.com/renato-lucindo/base-do-basquete/actions/runs/37819623679) concluíram em sucesso.
- **Limite da evidência:** o CI valida bootstrap do esquema versionado do GitHub, não upgrade em cópia fiel do banco remoto com seus três scripts exclusivos e divergências históricas. Não tratar este gate como homologação de deploy no Supabase principal. Revisões independentes de `database-security-reviewer`, `statistics-domain-reviewer` (BLOCK_RELEASE anterior) e `qa-reviewer` continuam pendentes; Etapa 4 não encerrada.
- Todas as alterações WIP locais em `codex/manual-scoresheet-v2` foram preservadas; nenhum merge nem início da Etapa 5.

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: PR #72, docs/execution/supabase-stage4-migration-reconciliation.md, banco de homologação isolado
ACAO: verificar upgrade sobre cópia fiel da baseline remota, completar revisões de segurança/estatística e QA, e somente depois considerar a aplicação das quatro migrations em ambiente autorizado; preservar WIP e histórico existente.
CRITERIO_DE_CONCLUSAO: pgTAP/RLS/concorrência e upgrade testados sobre baseline representativa, pareceres técnicos e QA válidos, sem reparação irreversível do histórico nem mudanças no Supabase compartilhado.
```

## 11. GitHub Actions — validação sem branch paga (08/10/2026)

Foi montado o job `remote_history_upgrade`, serializado após o job `database`, em `.github/workflows/ci.yml`. O gerador `scripts/test-stage4-remote-history-upgrade.mjs` reconstrói em PostgreSQL descartável uma baseline baseada nos 62 registros remotos, com cinco arquivos SQL extraídos do histórico real e cinco pré-requisitos locais para bootstrap. Não replica dados de produção e não toca o projeto Supabase remoto. Limitação: não é cópia fiel do banco real, dado histórico remoto com SQL ausente e arquivos históricos divergentes.

**Evidência funcional já obtida:** CI [37831964915](https://github.com/renato-lucindo/base-do-basquete/actions/runs/37831964915), `4daaf788`: 45 arquivos/1.228 pgTAP PASS no banco local, gate e E2E aprovados; o mesmo CI aplicou as quatro migrations em baseline reconstruída e as nove suítes relevantes passaram. A execução global do job histórico, porém, falhou em suítes antigas dependentes de seed/modelo de competições e foi restringida explicitamente às nove suítes focais. Uma falha de formatação do script na rodada posterior foi corrigida no checkpoint seguinte. O relatório completo está em `docs/execution/manual-scoresheet-stage4-github-actions-review.md`.

Revisão de segurança estatística realizada como **autoauditoria, não parecer independente**: RLS público/admin separado; LL coletivos validados contra conversões; tentativas sintéticas mascaradas; testes de CAS, rollback e preservação de FIBA presentes. A Etapa 4 **não está encerrada**, aguardando CI verde no HEAD efetivo e pareceres independentes de `database-security-reviewer`, `statistics-domain-reviewer` e `qa-reviewer`. WIP local preservado, PR ainda draft, sem `migration repair`, `db push`, merge, produção ou Etapa 5.

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: PR #72, GitHub Actions, docs/execution/manual-scoresheet-stage4-github-actions-review.md
ACAO: confirmar que todos os jobs do último commit estão verdes, obter pareceres técnicos e QA independentes; somente então considerar encerramento da Etapa 4.
CRITERIO_DE_CONCLUSAO: evidência verde no HEAD, revisão de segurança/estatística/QA válida e documentação consistente; nenhum WIP ou esquema compartilhado alterado.
```

### Resultado definitivo do ciclo GitHub Actions — 08/10/2026

**Código testado em `badb8ddf3b075e4cd228a757b5d6830fb6136ec6`: CI [37832981246](https://github.com/renato-lucindo/base-do-basquete/actions/runs/37832981246) COMPLETED/SUCCESS, incluindo quatro jobs aprovados: `gate`, `accessibility`, `database`, `remote_history_upgrade`. PostgreSQL descartável normal: **45 arquivos, 1.228 testes pgTAP PASS**, incluindo regressões de súmula manual v2, segurança/RLS, revisão e concorrência. PostgreSQL descartável com baseline de histórico remoto reconstruída: **62 migrations remotas + 5 pré-requisitos locais + quatro migrations de Etapa 4 aplicadas sem erro**, **9 arquivos, 314 testes pgTAP PASS**. CodeQL [37832981226](https://github.com/renato-lucindo/base-do-basquete/actions/runs/37832981226) COMPLETED/SUCCESS e preview [37832981113](https://github.com/renato-lucindo/base-do-basquete/actions/runs/37832981113) COMPLETED/SUCCESS. Não houve alteração no projeto Supabase compartilhado, que permanece em 62 migrations, com nenhuma migration da Etapa 4 aplicada.

**Critério independente não satisfeito:** a baseline montada no CI não é dump fiel do remoto (faltou SQL na história de `wp14_import_team_stats_assisted_players`, existem timestamps/SQL divergentes). Os pareceres independentes exigidos pelo contrato (`database-security-reviewer`, `statistics-domain-reviewer`, `qa-reviewer`) ainda **não foram executados por esses agentes**; nenhuma aprovação de release foi atribuída, e o BLOCK_RELEASE anterior não foi formalmente revogado. Portanto, a Etapa 4 permanece **em revisão**, a PR segue draft e os WIPs Windows permanecem preservados. Não avançar à Etapa 5.

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: PR #72, docs/execution/manual-scoresheet-stage4-github-actions-review.md, .agents/agent-contract.md
ACAO: obter pareceres independentes válidos dos revisores database-security e statistics-domain e, após ambos, QA; sanear quaisquer achados relevantes. Não fazer db push, migration repair, merge ou Etapa 5.
CRITERIO_DE_CONCLUSAO: pareceres válidos no HEAD efetivo, sem BLOCK_RELEASE, testes verdes e WIP preservado; somente então encerrar formalmente Etapa 4.
```

## 12. Pré-análise sequencial / bloqueio legítimo dos pareceres (08/10/2026)

GitHub HEAD remoto observado em 08/10: `c6639dd93bb3e1c87a9c7a51c328c37f3a3ee780`, `main` em `59fb0eeb7a9f99491e8b913dc9265a4f08ecb184`. O `HEAD_COMMIT` do WRITE_LOCK no início deste handoff registra um **checkpoint local anterior** e não deve ser interpretado como GitHub HEAD atual. Status do worktree Windows não disponível nesta sessão: preservar modificações locais não commitadas e reconciliar `git status` e `git log` antes de usar Git local.

Resultado da pré-análise de segurança, estatísticas e QA (não pareceres independentes): `docs/execution/manual-scoresheet-stage4-review-preflight.md`. CI funcional [37832981246](https://github.com/renato-lucindo/base-do-basquete/actions/runs/37832981246) verde, com 1.228 pgTAP e 314 focais no replay histórico. `get_advisors` remoto indica warnings de baseline preexistentes que exigem revisão contextual; cenário estatístico futuro `game.source=manual` + `player_advanced=fiba_boxscore` requer decisão do revisor. GitHub `mergeable_state=dirty`; a `main` também editou `.github/workflows/ci.yml`, `HANDOFF.md` e `app/types/database.generated.ts`. A PR não possui reviews submetidos. O REVIEW_PACKET foi publicado na PR com HEAD `c6639dd`; este commit documental de pré-análise necessita atualizar o packet ou validar delta documental quando a revisão real começar.

**Bloqueio:** os revisores customizados read-only não foram acionados por esta interface, que não possui token de execução de subagentes da unidade. Não simular aprovações. Bloqueio estatístico anterior permanece. Etapa 4 ativa, PR draft, sem merge, produção, Etapa 5, push ao Supabase compartilhado ou alteração de WIP.

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer (agentes Codex disponíveis no ambiente da unidade)
ARQUIVO_OU_SERVICO: PR #72 e .agents/agent-contract.md
ACAO: acionar database-security-reviewer, depois statistics-domain-reviewer, depois accessibility/boxscore se aplicável e qa-reviewer; resolver conflitos com main de forma conservadora, testar novo HEAD e obter pareceres válidos antes de encerrar Etapa 4.
CRITERIO_DE_CONCLUSAO: pareceres formais no mesmo HEAD, sem BLOCK_RELEASE, mergeable sem conflitos, CI green, WIP preservado.
```

## Main integration checkpoint (manual scoresheet Stage 4)

The feature branch was reconciled with current main by a two-parent merge. Main's edition/season workflow handoff is preserved without modification in `docs/execution/edition-creation-main-handoff-at-stage4-reconcile.md`. Current active unit remains MANUAL-SCORESHEET-V2-FIBA2024; the PR is still draft. The merge preserves the feature handoff and brings in main's season/division CI checks and migrations; the remote-history migration test remains. Re-run full CI on the merged HEAD. Reviewer approvals from database-security-reviewer, statistics-domain-reviewer, accessibility-ui-reviewer and qa-reviewer remain pending, and previous statistics BLOCK_RELEASE is not waived. Do not deploy or merge until the gates and independent reviews are valid.

PROXIMO_PASSO_EXATO: verify Stage 4 Validation and main CI at merged HEAD; obtain real independent reviewer opinions, preserving all local WIP and leaving shared Supabase untouched.

## 14. Conciliação concluída com main e gate renovado — 08/10/2026

A branch `codex/manual-scoresheet-v2` integrou `main@59fb0eeb7a9f99491e8b913dc9265a4f08ecb184` por merge conservador **`ae1a5eddd08bf46dd25fecc96e41cf4620e1f557`** (pais `836e7c1` e `59fb0ee`). Conflitos de `.github/workflows/ci.yml` e `HANDOFF.md` foram conciliados sem descartar o conteúdo da unidade: o HANDOFF anterior da main foi arquivado em `docs/execution/edition-creation-main-handoff-at-stage4-reconcile.md`, os tipos gerados foram mesclados automaticamente pelo Git.

O workflow CI foi então atualizado para incorporar **os novos gates de season/division/edition da main** e **preservar o job remoto reconstruído da súmula v2**, por meio de commit posterior à reconciliação. A rotina temporária de merge automático foi desativada. Requer CI/Stage 4 Validation no HEAD resultante. O merge não representa deploy, nem revoga o BLOCK_RELEASE estatístico anterior; os pareceres independentes continuam necessários. O worktree Windows (incluindo os cinco arquivos WIP) não foi alterado por esta ação remota.

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: PR #72, GitHub Actions CI e Stage 4 Validation, .agents/agent-contract.md
ACAO: validar o HEAD após a integração de main, corrigir regressões de CI se houver, acionar revisores independentes de banco/segurança e estatística, depois UI/QA; atualizar review packet com os pareceres emitidos.
CRITERIO_DE_CONCLUSAO: integração limpa, gates verdes no HEAD, ausência de BLOCK_RELEASE e pareceres independentes válidos. Sem db push, migration repair, merge na main ou Etapa 5 antes disso.
```

## 15. Checkpoint de transicao para governanca v3 — 09/10/2026

A PR #75 foi integrada em main no commit `27d917a1ce4a404ced091fd3ca660113c215ca92`. Esta unidade `MANUAL-SCORESHEET-V2-FIBA2024`, PR #72 draft, reconcilia as regras de risco da v3 por merge conservador em worktree isolada. O conflito ficou restrito ao HANDOFF; o historico anterior da sumula foi preservado. O checkpoint da PR #75 permanece verificavel em `main@27d917a:HANDOFF.md`.

WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-FIBA2024; BRANCH=codex/manual-scoresheet-v2; STATUS=ACTIVE; SCOPE=conciliacao com main, revisoes criticas independentes e fechamento documental da Etapa 4; sem etapas 5-10 nem migrations compartilhadas.

HEAD anterior da PR #72: `c6a97f4c67cbf5a55f8a8b8993b2b5727f4e4b14`. O HEAD final de revisao sera identificado no REVIEW_PACKET remoto apos os commits de merge e documentacao. A politica v3 exige database-security-reviewer e statistics-domain-reviewer para RLS/RPC/persistencia e denominadores de LL/isolamento estatistico. O BLOCK_RELEASE estatistico antigo nao esta dispensado; somente parecer independente novo pode encerra-lo. QA e acessibilidade dependem de evidencias e requisitos explicitos do plano. A reconstrucao das 62 migrations historicas no CI nao e clone fiel de producao. Nenhuma migration desta unidade foi aplicada ao banco compartilhado.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=GitHub PR #72 e Actions; ACAO=publicar REVIEW_PACKET v3 no HEAD reconciliado, obter novos pareceres independentes de seguranca e estatistica, corrigir eventuais BLOCK_RELEASE, verificar CI/CodeQL/Stage4 Validation no SHA final e formalizar o encerramento da Etapa 4 somente se aprovado; CRITERIO_DE_CONCLUSAO=pareceres validos e checks verdes no HEAD final, PR draft preservada, sem deploy de migrations ou merge.

## 16. Correção de autoridade estatística por domínio — 09/10/2026

- Worktree de revisão `manual-stage4-v3-review`, branch local `codex/manual-stage4-v3-review`, PR draft #72 com upstream `origin/codex/manual-scoresheet-v2`. HEAD de partida verificado: `794490d4c960428f2b077c3c40d106cbe9b7e5f7`. WRITE_LOCK mantido por `project-maintainer` para a unidade `MANUAL-SCORESHEET-V2-FIBA2024`.
- O delta preservado substitui `games.source` pela autoridade efetiva de `game_active_data_sources` para `player_scoring` e `player_advanced` nos read models estatísticos. LL coletivos manuais usam a projeção pública da submissão ativa; tentativas avançadas são expostas somente quando há autoridade FIBA. Ausência de tentativas não vira zero artificial, inclusive na agregação entre partidas de fontes distintas.
- A migration `20261008140000_manual_scoresheet_v2_collective_ft_public_projection.sql` mantém RLS, restringe a leitura pública às colunas `game_id` e `free_throw_summary`, oculta `submission_id` e publica exclusivamente a projeção da submissão manual efetivamente ativa. SQL pgTAP focal ampliado de 8 para 14 verificações; teste de segurança SQL (24 verificações) atualizado para grants por coluna e policy de autoridade corrente.
- Evidência local informada na execução de 09/10: suíte Vitest completa **58 arquivos, 500 testes PASS**, incluindo 20 testes focais; formatação (202 arquivos), lint (sem erros; 299 warnings e 20 informativos), typecheck, build, check:runbooks, check:agents e varredura de segredos (736 arquivos rastreados) PASS. `git diff --check` PASS após a atualização SQL. A ferramenta auxiliar `inspect-work-unit.mjs` falhou ao tentar ler `stderr.trim()` indefinido no Node 24; `git status`, `git log` e diff foram verificados diretamente.
- **Pendente:** executar pgTAP sobre PostgreSQL descartável via GitHub Actions no HEAD efetivamente publicado, verificar jobs CI, Stage 4 Validation e CodeQL, e obter pareceres independentes `database-security-reviewer` e `statistics-domain-reviewer` (BLOCK_RELEASE anterior ainda vigente), com QA após as revisões críticas. A reconstrução remota de 62 migrations não representa dump fiel do Supabase compartilhado. Nenhuma migration desta unidade foi aplicada ao Supabase compartilhado e nenhum merge na `main` foi autorizado.

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: PR #72, workflow .github/workflows/stage4-validation.yml, GitHub Actions CI/CodeQL e .agents/agent-contract.md
ACAO: publicar o delta estatístico com commit na branch da PR #72; executar e conferir pgTAP focal e completo em PostgreSQL descartável no Actions, documentando run IDs e resultados no REVIEW_PACKET; pedir revisão independente de segurança e estatísticas no mesmo SHA e preservar a PR draft enquanto houver BLOCK_RELEASE.
CRITERIO_DE_CONCLUSAO: jobs de validação do HEAD publicado concluídos e evidenciados, pareceres críticos reais sem bloqueios; sem migrations no Supabase compartilhado, merge na main ou início da Etapa 5.
```

## 17. Correção focal de permissão no pgTAP — 09/10/2026

- Estado reconciliado: PR #72 aberta/draft em `3baf771b78b369c30ae0bd039b504db5b7487e37`, worktree `manual-stage4-v3-review` inicialmente limpo, `WRITE_LOCK` ativo do `project-maintainer` na unidade `MANUAL-SCORESHEET-V2-FIBA2024`.
- GitHub Actions **Stage 4 Validation 38016040274** falhou em `manual_scoresheet_v2_atomic_create.test.sql`: durante o teste de criação, o papel `authenticated` tentou selecionar `submission_id` da projeção pública, embora a migration conceda SELECT apenas para `game_id` e `free_throw_summary`. A execução marcou 16 de 37 asserts nesse arquivo e terminou em falha. Isso é uma incompatibilidade do teste com a proteção de coluna privada, não motivo para ampliar o grant.
- Correção focal: em `supabase/tests/database/manual_scoresheet_v2_atomic_create.test.sql`, a asserção interna de vínculo entre projeção e submissão ativa executa temporariamente como owner do teste (`reset role`) e restaura imediatamente `authenticated`. O SELECT de `submission_id` continua proibido a `anon` e `authenticated`; migration e regras de RLS não foram alteradas.
- Gate SQL de regressão pendente de reexecução em PostgreSQL descartável do GitHub Actions após push do commit de correção. Resultados e SHA definitivo devem constar no REVIEW_PACKET da PR. Evidência local anterior (500 Vitest, typecheck, build, lint, formatação e varredura de segredos) continua válida para o código inalterado; a alteração atual afeta somente o pgTAP.
- Risco remanescente CRITICO: aprovação independente de `database-security-reviewer` e `statistics-domain-reviewer` no SHA final, com BLOCK_RELEASE estatístico anterior ainda aberto; cobertura QA/acessibilidade conforme REVIEW_PACKET. A baseline reconstruída no CI não equivale a clone fiel do Supabase compartilhado. PR permanece draft; sem migrations compartilhadas, merge em main, produção ou Etapa 5.

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: PR #72, .github/workflows/stage4-validation.yml e CI no GitHub Actions
ACAO: commitar e enviar a correção focal de pgTAP; verificar execução completa dos 37 asserts em manual_scoresheet_v2_atomic_create.test.sql, suíte SQL integral e jobs CI/Stage 4 Validation/CodeQL no novo SHA; atualizar REVIEW_PACKET com evidências e solicitar pareceres independentes de banco/segurança e estatística.
CRITERIO_DE_CONCLUSAO: SQL/CI verdes e resultados registrados no SHA final, sem BLOCK_RELEASE e com pareceres críticos válidos antes de encerrar Etapa 4; PR draft e Supabase compartilhado preservados.
```

## 18. Verificação no SHA b05b243 e revisões independentes — 09/10/2026

- HEAD funcional validado na PR #72: `b05b24399ab51dcd31d2076ccfc2f86f48f94b5b`; worktree `manual-stage4-v3-review` inicialmente limpo. Commits relevantes: `3baf771` (autoridade estatística por domínio) e `b05b243` (correção da asserção pgTAP sob o owner do teste).
- GitHub Actions executados no SHA funcional e concluídos com `SUCCESS`: Stage 4 Validation [38016641258](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38016641258), CI [38016645276](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38016645276), CodeQL [38016645285](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38016645285) e preview [38016645274](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38016645274).
- Stage 4 Validation: job `Security + statistics (pgTAP)` concluiu **49 arquivos/1.383 testes PASS**, incluindo os 37 asserts integrais da súmula atômica; job `Remote-history upgrade` concluiu **9 arquivos/320 testes PASS**. CI normal aprovou `database`, `accessibility`, `gate` e `remote_history_upgrade`. Banco utilizado: PostgreSQL descartável; baseline histórica reconstruída não equivale a clone fiel do Supabase compartilhado.
- `accessibility-ui-reviewer`: parecer independente `APPROVE_WITH_NON_BLOCKING_NOTES` no SHA `b05b243`, 09/10/2026 23:29 -03:00. Sem regressão bloqueante de acessibilidade, observando lacuna de E2E direto da tabela coletiva e futuro editor de revisões.
- `qa-reviewer`: parecer independente `BLOCK_RELEASE` no SHA `b05b243`, 09/10/2026 23:32 -03:00, **exclusivamente por gates de governança** (revisões independentes de banco/segurança e estatística ainda necessárias). O QA considerou cobertura automatizada adequada e não identificou defeito funcional bloqueante novo; observação P3 para teste integrado adicional dos LL coletivos após revisões.
- `database-security-reviewer`: parecer independente `APPROVE_WITH_NON_BLOCKING_NOTES` no SHA `b05b243`, 09/10/2026 23:40 -03:00; revisão read-only das quatro migrations, RLS, grants por coluna, RPC transacional, histórico, concorrência e teste com troca temporária de papel, sem vulnerabilidade bloqueante identificada nos trechos examinados. Não certifica os consumidores estatísticos globais.
- `statistics-domain-reviewer`: tentativa de acionar revisão independente recusada pela ferramenta com `This tool call was blocked by OpenAI because we couldn't determine the safety status of the request.` Nenhum parecer estatístico foi emitido; o `BLOCK_RELEASE` anterior permanece vigente.
- O REVIEW_PACKET v3 recebeu addendum no corpo da PR #72 com HEAD, escopo, riscos, quatro links de workflows e pendência de pareceres. A PR permanece **aberta e draft**, sem merge, migrations no Supabase compartilhado, produção ou Etapa 5. O write lock do `project-maintainer` continua ativo para registro e correção focal de eventuais achados.

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: PR #72, .agents/database-security-reviewer.md, .agents/statistics-domain-reviewer.md, .agents/agent-contract.md e GitHub Actions
ACAO: obter autorização de execução aceita para o revisor estatístico, obter parecer formal no HEAD funcional e sanar eventuais bloqueios; atualizar REVIEW_PACKET com decisões verificáveis, revalidar apenas o que for afetado e reavaliar o BLOCK_RELEASE de QA. Não aplicar migrations remotas, fazer merge nem iniciar Etapa 5.
CRITERIO_DE_CONCLUSAO: pareceres críticos independentes válidos no mesmo artefato funcional e ausência de BLOCK_RELEASE, com CI, pgTAP, CodeQL e preview verdes, PR ainda draft até decisão expressa de integração.
```

## 19. Parecer estatistico independente — 10/10/2026

- `statistics-domain-reviewer` acionado e executado em modo read-only no commit `f24caeeadb6c55ff586e750c59000bcdf5fc473d` (HEAD funcional `b05b243`); `BASE_COMMIT=27d917a1ce4a404ced091fd3ca660113c215ca92`; `REVIEWED_AT=2026-10-10 00:19 -03:00`. Parecer formal: **BLOCK_RELEASE**, revogacao do bloqueio anterior **NEGADA**. A revisao de estatisticas foi de fato executada; a recusa anterior da ferramenta permanece apenas como historico.
- **P1 — ausencia convertida em zero:** `supabase/migrations/20261008140000_manual_scoresheet_v2_collective_ft_public_projection.sql:229-233` utiliza `coalesce(stat.free_throw_attempted, 0)` sobre `LEFT JOIN` de estatisticas ao roster sob autoridade FIBA, podendo produzir zero para atleta sem registro avancado; `app/modules/statistics/public-sports.server.ts:413-425` pode interpretar a linha como dado completo. Necessario diferenciar `NULL` (desconhecido), zero real e `did_not_play`, adicionar regressao PostgreSQL que cubra roster sem linha de estatisticas e teste focal do consumidor.
- **P2 — snapshot publicado:** `app/modules/statistics/public-sports.server.ts:206-213` retorna `public_get_competition_publication` antes de resolver autoridade por dominio. Exigir teste integrado de consistencia/invalidacao da publicacao apos revisao e troca de autoridade; nao ha incorrecao concreta do snapshot comprovada apenas pelo early return.
- **P2 — isolamento entre consumidores:** validar em testes integrados combinacoes distintas de `player_scoring` e `player_advanced` entre `game_player_statistics`, `public-statistics.server.ts`, `player-profile.server.ts` e estatisticas publicas de equipe/competicao; lacuna de cobertura, sem corrupcao confirmada.
- **Melhorias confirmadas:** `3baf771` utiliza `game_active_data_sources` por dominio e preserva algumas tentativas desconhecidas como `null`; migration e pgTAP protegem LL coletivos. Todos os gates em `f24caee` continuam registrados como verdes: Stage 4 Validation 38017977886 (49/1.383 pgTAP + 9/320 no historico), CI 38017980701, CodeQL 38017980694, preview 38017980693. Os testes automáticos anteriores nao eliminam o P1/P2.
- `database-security-reviewer` e `accessibility-ui-reviewer` mantem `APPROVE_WITH_NON_BLOCKING_NOTES` vinculados ao artefato funcional `b05b243`; `qa-reviewer` mantem `BLOCK_RELEASE` por governanca. PR #72 permanece **draft**, Etapa 4 em revisao, sem migration no Supabase compartilhado, merge em main, producao ou Etapa 5. Revisao read-only nao alterou arquivos.

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: supabase/migrations/20261008140000_manual_scoresheet_v2_collective_ft_public_projection.sql, app/modules/statistics/public-sports.server.ts, supabase/tests/database, app/modules/statistics/*.test.ts, PR #72
ACAO: corrigir o P1 de NULL versus zero com teste SQL/consumidor; provar por regressao de integracao a consistencia de snapshots publicados apos revisao/troca de autoridade e do isolamento entre todos os read models; executar testes focais e gates pertinentes em PostgreSQL descartavel; pedir novo parecer independente statistics-domain-reviewer no commit corrigido e reavaliar o bloqueio QA.
CRITERIO_DE_CONCLUSAO: nenhum P1 estatistico em aberto, cenarios P2 cobertos, gates verdes no HEAD funcional corrigido e novo parecer independente capaz de revogar explicitamente o BLOCK_RELEASE; preservar PR draft e nao tocar Supabase compartilhado.
```

## 20. Correcoes dos achados estatisticos P1/P2 — 10/10/2026

O maintainer preparou uma correcao focal da PR #72 no codigo de autoridade estatistica. A view `game_player_statistics` conserva NULL nas tentativas de arremesso quando o jogador consta no elenco mas nao tem registros avancados, mesmo sob autoridade FIBA; DNP explicitamente declarado nao representa participacao. A view `game_boxscore_player_statistics` passa a exigir linha de estatisticas para expor cobertura avancada, protegendo tambem o agregado de competicao e o perfil. O consumidor `public-sports.server.ts` verifica tentativas nulas por jogador ativo antes de declarar percentuais e eficiencia completos.

Regressoes propostas: SQL no fixture Basketball Site com remocao temporaria de stats sob SAVEPOINT, verificando jogo/competicao/perfil e DNP; Vitest para roster FIBA parcial; SQL com publicacao manual inicial, revisao e comparacao do snapshot congelado + invalidacao do fingerprint, e teste de snapshot para impedir leitura de autoridade ainda nao republicada. O modelo de publicacao editorial continua versionado: o publico ve o snapshot confirmado anterior ate uma nova publicacao, e a leitura do jogo alterado exige fingerprint valido.

Nenhuma migration foi aplicada no Supabase compartilhado e nenhum merge foi realizado. EVIDENCIA_GIT: HEAD funcional `b6fbf6bb2234102dd6bc9ed09fca14908cbb39de`, Stage 4 Validation 38055387765 SUCCESS com 49 arquivos/1392 pgTAP e 9 arquivos/329 testes no replay historico; CI 38055390398 SUCCESS (gate, banco, acessibilidade e replay), CodeQL 38055390386 SUCCESS e preview 38055390392 SUCCESS. Regressoes SQL executadas em PostgreSQL descartavel. PENDENTE: obter pareceres independentes renovados de `statistics-domain-reviewer` e `database-security-reviewer` no novo artefato, reconciliar QA e somente entao decidir sobre o BLOCK_RELEASE. A baseline historica de CI nao representa dump fiel do compartilhado.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=PR #72/Actions e .agents/statistics-domain-reviewer.md; ACAO=verificar pgTAP completo e focal, CI, preview e CodeQL no commit corrigido; ajustar qualquer falha, solicitar pareceres independentes renovados e registrar resultados na PR; CRITERIO_DE_CONCLUSAO=regressoes verdes no SHA corrigido e parecer estatistico capaz de levantar o BLOCK_RELEASE, mantendo draft e Supabase compartilhado intactos.

## 21. Reconciliação local e republicação após revisão — 10/10/2026

O worktree manual-stage4-v3-review avançou conservadoramente de d8af620 para 06ffcd7, incorporando as correções remotas existentes 2984f6c..b6fbf6b sem descartar mudanças. Actions no HEAD 06ffcd7: Stage4 38055861393 (49/1392 pgTAP + 9/329 histórico), CI 38055863749, CodeQL 38055863758 e preview 38055863745 SUCCESS. Vitest local estatístico: 10 arquivos/64 testes PASS. Revisões independentes renovadas de segurança e estatística emitiram APPROVE_WITH_NON_BLOCKING_NOTES no 06ffcd7; estatística revogou expressamente o BLOCK_RELEASE anterior.

A investigação complementar identificou caso ainda não coberto: revisão só de notas/penalidades muda officialResultSubmissionId/fingerprint, mas pode não mudar o snapshot JSON. Review/publicação manual compara somente JSON e pode retornar a versão antiga sem renovar fingerprints. WRITE_LOCK segue do project-maintainer para corrigir focalmente review.changed e idempotência da republicação dentro da migration Stage4 ainda não aplicada, com regressão de notas/penalidades, visibilidade anon e retry. Pareceres serão renovados para o delta antes do fechamento; QA aguarda. Nenhuma migration remota/merge/Etapa5.

PROXIMO_PASSO_EXATO: em 20261008140000_manual_scoresheet_v2_collective_ft_public_projection.sql e manual_scoresheet_v2_revisions.test.sql, corrigir detecção de fingerprints alterados e comprovar republicação real restaura acesso público sem mutar snapshots anteriores; conferir pgTAP no Actions e renovar estatística/segurança/QA.
Correção focal preparada: revisão editorial compara fingerprints dos jogos da publicação vigente; publicação só retorna idempotentemente quando review.changed=false. Adicionadas 16 asserções pgTAP (plano 60) de republicação de notas/penalidades, retry, leitura anon e snapshots imutáveis. Gate local npm run check PASS (formatação/lint/typecheck/Vitest/runbooks/agentes/build/segredos); pgTAP novo pendente no Actions. QA independente confirmou o novo P1 no 06ffcd7; seu bloqueio permanece até evidência e renovação focal.

Actions f246971 (Stage4 38093931733): 57 asserts executados sem falha antes de erro de cursor pgTAP na consulta esperada VALUES(2,4) sem espaço; ajuste focal para SELECT 2,4 evita a classificação de consulta preparada do pgTAP. SQL funcional e demais testes preservados. Reexecução pendente no commit de teste.

## 22. Fechamento das pendências estatísticas e republicação — 10/10/2026

**Etapa 4 backend: READY.** Artefato revisado e testado: `86934cc16d8c4662f2a07e30868b6e10eea47c0a`; base `27d917a1ce4a404ced091fd3ca660113c215ca92`. Correções de ausência/zero e isolamento preservadas de `2984f6c..b6fbf6b`; correção adicional de republicação `f246971`, ajuste focal de consulta pgTAP `86934cc`. Não houve descarte de trabalho; worktree manual-stage4-v3-review limpo e sincronizado antes deste registro exclusivamente documental.

- P1 ausência versus zero: tentativas de atleta com roster mas sem stats efetivas ficam NULL; DNP tratado separadamente; cobertura avançada exige registro. Read models de jogo/competição/perfil e consumidor de equipes protegidos.
- P2 publicação e isolamento: snapshot editorial anterior permanece congelado; revisão invalida fingerprint; testes confirmam autoridades manual/FIBA no mesmo jogo e LL ponderados entre jogos, sem depender de games.source.
- P1 adicional de republicação (QA no 06ffcd7): resolvido. Review.changed compara fingerprints privados vigentes; retorno idempotente de publicação exige ausência de mudança. Notas e penalidades podem ser republicadas mesmo com JSON/placar igual. As 16 novas regressões verificam restauração de acesso anon, denominadores bilaterais 2/4, nova versão, retry idempotente e imutabilidade do primeiro snapshot.

### Pareceres independentes consolidados

| Revisor | Decisão | Commit / data |
| --- | --- | --- |
| statistics-domain-reviewer (Mendel) | APPROVE_WITH_NON_BLOCKING_NOTES; **BLOCK_RELEASE estatístico expressamente revogado**, inclusive republicação | 86934cc; 10/10/2026 20:14:35 -03:00 |
| database-security-reviewer (Archimedes) | APPROVE_WITH_NON_BLOCKING_NOTES; auth/AAL2, CAS, locks, grants e search_path preservados; nenhum bloqueador | 86934cc; 10/10/2026 20:11:34 -03:00 |
| qa-reviewer (Dirac) | APPROVE_WITH_NON_BLOCKING_NOTES; **BLOCK_RELEASE de QA expressamente revogado**, inclusive P1 de republicação | 86934cc; 10/10/2026 20:17:53 -03:00 |
| accessibility-ui-reviewer (Ohm) | APPROVE_WITH_NON_BLOCKING_NOTES no domínio de UI preservado; validade incremental confirmada pelo QA, sem nova interação/UI | b05b243; 09/10/2026 23:29 -03:00 |

A renovação estatística e a de segurança são focais ao delta desde 06ffcd7, sobre seus pareceres anteriores da PR. Não houve aprovação simulada ou dispensa de especialista crítico. CI/preview executaram o merge sintético 4c960744; QA confirmou árvore idêntica à do HEAD revisado.

### Evidências no artefato final

- [Stage4 38094118567](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38094118567): **SUCCESS**, quatro jobs aprovados. PostgreSQL descartável: **49 arquivos/1.408 pgTAP PASS**, revisão **60/60**; replay histórico **9 arquivos/345 pgTAP PASS**; QA/browser e integração com main aprovados.
- [CI 38094121800](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38094121800): **SUCCESS**, gate, banco, acessibilidade e replay aprovados.
- [CodeQL 38094121719](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38094121719) e [preview 38094121702](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38094121702): **SUCCESS**. Preview com smoke público, privacidade, acessibilidade/reflow aprovados.
- Gate local npm run check: PASS, incluindo **58 arquivos/502 Vitest**, formatação/lint/typecheck/runbooks/agentes/build/segredos. Módulo estatístico focal: **10 arquivos/64 testes PASS**. Browser: **9 aprovados/1 skip conhecido**.
- Primeiro run da republicação parou após 57 asserts por consulta esperada VALUES sem whitespace; ajuste SELECT explícito revalidado integralmente. Essa falha está encerrada.

Riscos residuais não bloqueantes: replay histórico é reconstrução aproximada, não clone fiel do banco compartilhado; rollout remoto não certificado. Nota P3 do revisor: fortalecer futuramente o teste Vitest somente FIBA com atleta completo e outro sem stats (o caso misto já verifica ausência, mas mascara parte das métricas). Não resta P1/P2 ou BLOCK_RELEASE aberto neste checkpoint. Não houve migration no Supabase compartilhado, merge, produção ou Etapa 5. PR permanece DRAFT; write lock entregue.

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: PR #72 e docs/plan/sumula-manual-v2/05-wizard-jogo-equipes.md
ACAO: manter PR draft e checkpoint aprovado da Etapa 4; na próxima unidade explicitamente autorizada, reconciliar Git/HANDOFF e reassumir write lock antes de implementar a configuração restaurável do wizard conforme Etapa 5. Aplicação compartilhada de migrations e merge permanecem fora deste escopo.
CRITERIO_DE_CONCLUSAO: esta entrega se encerra com HANDOFF/PR consistentes, commit documental publicado, artefato 86934cc verde e pareceres válidos; continuação de interface exige seu próprio escopo, testes e checkpoint.
```

## 23. Etapa 5 — wizard de jogo e equipes (11/10/2026)

WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-FIBA2024-STAGE5; BRANCH=codex/manual-stage4-v3-review; HEAD_COMMIT=e21c918f5d35370fe7dce9327cebf77e5921df1b; STATUS=RELEASED; SCOPE=etapas Jogo e Equipes do wizard, rascunho localStorage, metadata, atletas/roster, titular/capitão, comissão técnica e oficiais; testes focais e gate. EXCLUSO=Supabase compartilhado, migrations remotas, merge na main, deploy em produção e etapas 6–10.

O commit c45e112 foi reconciliado em worktree limpo antes da abertura. Etapa 4 concluída conforme seção 22. Próximo checkpoint: configurar e restaurar o wizard integralmente sem escrita de rascunho no servidor, com validação UI, testes e HANDOFF final.

### Checkpoint funcional Etapa 5 — `e21c918` (11/10/2026)

- **Implementado:** wizard local nas etapas Jogo e Equipes, com mandante/visitante, data obrigatória, horário/local/número/rodada/observações opcionais, até 12 atletas por equipe, números de camisa, titulares, capitão, comissão técnica e oficiais recolhíveis. Vínculo `captain_placeholder` acompanha troca do capitão e é desfeito em edição manual. O editor anterior permanece acessível por `?modo=existente`.
- **Rascunho:** editor versionado `v3-setup`, armazenado somente no `localStorage`, com retomada/descarte, validação de elenco ao restaurar, autosave e aviso de alterações não salvas. A configuração nova não envia POST; confirmação definitiva e lançamentos integram as etapas posteriores.
- **Verificação local:** Vitest focal 4 arquivos/50 testes PASS antes do incremento de fixture; `npm run typecheck` PASS; gate único `npm run check` **PASS** em 11/10/2026: 60 arquivos/507 Vitest, formatação, lint (avisos preexistentes), typecheck, runbooks, agentes, build e verificação de segredos (740 arquivos). `git diff --check` PASS. O banco não foi alterado; pgTAP de Etapa 4 permanece em evidência anterior, sem mudanças SQL nesta etapa.
- **Risco:** MODERADO (wizard de interface e estado local). `database-security-reviewer`, `statistics-domain-reviewer` e `boxscore-domain-reviewer`: WAIVED **somente para o delta da Etapa 5**, pois nenhum contrato, fórmula, autoridade, migration, RLS ou backend foi modificado. `accessibility-ui-reviewer` e QA: revisão focal pendente, pois o teste de renderização SSR e os testes do estado não cobrem navegação interativa de teclado e viewport. Nenhum parecer independente foi presumido.
- **Estado de entrega:** código e testes commitados em `e21c918`; evidências GitHub Actions no SHA publicado e review packet da Etapa 5 devem ser verificados na PR #72. Etapas 6–10 e merge continuam pendentes.

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: PR #72 no GitHub Actions; app/modules/scoresheet/setup-wizard.tsx; docs/plan/sumula-manual-v2/06-lancamento-rapido-pontos.md
ACAO: verificar os checks de CI/preview no commit publicado da Etapa 5 e coletar a revisão focal de acessibilidade/QA do wizard; corrigir achados relevantes antes de declarar este checkpoint aprovado. Somente depois abrir nova unidade com write lock para a Etapa 6 (lançamento de pontos por teclado e integração com o estado local), sem merge, produção ou migrations compartilhadas.
CRITERIO_DE_CONCLUSAO: checks da PR #72 verdes no SHA publicado, teste de restauração e navegação do wizard verificados, riscos de UI avaliados, HANDOFF e REVIEW_PACKET da Etapa 5 atualizados.
```

## 24. Correções da revisão da Etapa 5 (11/10/2026)

WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE5-REVIEW-FIXES; BRANCH=codex/manual-stage4-v3-review (destino remoto da PR: codex/manual-scoresheet-v2); BASE_COMMIT=49b08ca51ed04398e4cc8da7882ee38a1d05a2a1; CODE_HEAD_COMMIT=aaf19ae27cbd57d197d92d156bdde9e6a46286ca; STATUS=RELEASED; SCOPE=rascunho, nome do técnico, acessibilidade dos controles, foco de validação, testes focais e gate PR #72. EXCLUSO=Supabase compartilhado, migrations remotas, merge main, produção, Etapas 6–10.

Objetivo: corrigir quatro achados da revisão REQUEST_CHANGES no HEAD `49b08ca`. Aceite: testes de estado/UI, gate aplicável, HANDOFF atualizado e renovação da revisão independente antes da Etapa 6.

Resultado no commit funcional `aaf19ae`: (1) leitura do rascunho local bloqueia a edição e o autosave até a decisão explícita de restaurar/descartar, preservando a versão anterior; (2) edição do nome do técnico preserva espaços durante a digitação e rompe o vínculo com o capitão; (3) os controles de titular e capitão incluem equipe e número do slot no nome acessível; (4) os erros de validação recebem foco e são anunciados. Fixture Playwright isolada, sem Supabase, cobre os quatro problemas.

Validação local em 11/10/2026: `npm run check` **PASS** (formatação, lint sem erros bloqueantes, typecheck, Vitest **60 arquivos/508 testes**, runbooks, configuração de agentes, build client/SSR e varredura de segredos de **743 arquivos versionados**). `PLAYWRIGHT_BASE_URL=http://127.0.0.1:1 npx playwright test e2e/manual-scoresheet-setup.spec.ts --workers=1` **PASS 6/6**: rascunho e retomada, foco e nomes acessíveis, digitação de técnico, axe sem violações reportadas na fixture e reflow em 320/390/720/1280 px. `git diff --cached --check` PASS no commit de código. Avisos preexistentes não bloqueantes do Biome foram preservados fora do escopo.

REVIEW_PACKET — correções Etapa 5:
- WORK_UNIT: MANUAL-SCORESHEET-V2-STAGE5-REVIEW-FIXES
- BRANCH_REMOTA: codex/manual-scoresheet-v2 (PR #72, permanece DRAFT)
- BASE_COMMIT: 49b08ca51ed04398e4cc8da7882ee38a1d05a2a1
- CODE_HEAD_COMMIT: aaf19ae27cbd57d197d92d156bdde9e6a46286ca (o checkpoint documental posterior não altera o código revisado)
- CRITERIOS_DE_ACEITE: proteger rascunho, preservar espaços de técnico, distinguir nomes dos controles e focalizar os erros; testes locais e CI publicados; revisões independentes de UI/acessibilidade e QA.
- ARQUIVOS_DO_DELTA: app/modules/scoresheet/setup-state.ts; app/modules/scoresheet/setup-state.test.ts; app/modules/scoresheet/setup-wizard.tsx; e2e/fixtures/manual-scoresheet-setup.fixture.tsx; e2e/fixtures/manual-scoresheet-setup.html; e2e/manual-scoresheet-setup.spec.ts; HANDOFF.md.
- ESCOPO_NEGATIVO: migrations, Supabase compartilhado, main/merge, produção, Etapas 6–10.
- RISCO_RESIDUAL: aguardam checks GitHub Actions no SHA publicado, parecer independente accessibility-ui-reviewer e qa-reviewer; cobertura axe restrita à fixture local. Não atribuir parecer aprovado antes da revisão.
- WRITE_LOCK_OWNER: RELEASED (project-maintainer); revisões subsequentes read-only até nova unidade de correção.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer (coordenação, sem lock de escrita durante revisão)
ARQUIVO_OU_SERVICO: GitHub PR #72 — checks GitHub Actions e review packet da Etapa 5.
ACAO: validar CI, PostgreSQL descartável/pgTAP se acionado, preview e CodeQL no HEAD publicado; obter revisão independente de accessibility-ui-reviewer e qa-reviewer referente ao delta `49b08ca..HEAD`; registrar pareceres e só então decidir o fechamento da Etapa 5. Corrigir novos achados mediante nova unidade e write lock, sem iniciar Etapa 6.
CRITERIO_DE_CONCLUSAO: SHA de revisão publicado e rastreado, checks da PR verdes, pareceres independentes emitidos sem bloqueios ativos e HANDOFF atualizado com evidências reais; PR permanece DRAFT.

## 25. Revisao Stage 5 - delta (11/10/2026)

WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE5-REVIEW-DELTA; BRANCH=codex/manual-stage4-v3-review (branch remota PR #72: codex/manual-scoresheet-v2); BASE_COMMIT=4a4d0d19934b61756dad1cc01fced2b1f78c5a79; CODE_HEAD_COMMIT=7b4198930eba96550c8d860f3118821dba80351e; STATUS=RELEASED; SCOPE=quatro achados QA/acessibilidade, testes e revisao independente; EXCLUSO=Supabase compartilhado, migrations remotas, main/merge, producao, Etapa 6.

O delta corrige os REQUEST_CHANGES da revisao anterior no commit 4a4d0d1: isolamento de competicoes (P1), persistencia do rascunho ao navegar internamente antes dos 400 ms de debounce (P2), retorno do foco ao titulo apos restaurar/descartar (P2) e vinculacao de mensagens de erro aos controles invalidos por campo/slot com aria-invalid e aria-describedby (P2). Fixture roteada permite testar duas competicoes e navegacao sem Supabase. Commit funcional publicado: 7b41989.

REVIEW_PACKET FINAL (11/10/2026):
- WORK_UNIT: MANUAL-SCORESHEET-V2-STAGE5-REVIEW-DELTA.
- BRANCH_REMOTA: codex/manual-scoresheet-v2; PR: #72, OPEN/DRAFT.
- BASE_COMMIT: 4a4d0d19934b61756dad1cc01fced2b1f78c5a79; CODE_HEAD_COMMIT_REVISADO: 7b4198930eba96550c8d860f3118821dba80351e.
- ARQUIVOS_ALTERADOS: app/modules/scoresheet/setup-wizard.tsx; e2e/fixtures/manual-scoresheet-setup.fixture.tsx; e2e/manual-scoresheet-setup.spec.ts; HANDOFF.md.
- GATES_LOCAIS: npm run check PASS (60 arquivos/508 Vitest, formatacao, lint sem erros bloqueantes, typecheck, runbooks, agentes, build client/SSR, scan de segredos em 743 arquivos); Playwright focal PASS 7/7, axe sem violacoes reportadas na fixture, viewport 320/390/720/1280, restauracao/descarte com teclado, isolamento entre competicoes, flush de navegacao, erros acessiveis; git diff --check PASS.
- GITHUB_ACTIONS no SHA 7b41989: CI 38174397300 SUCCESS (inclui banco, replay historico, gate e acessibilidade); Stage 4 Validation 38174395271 SUCCESS (pgTAP de seguranca/estatisticas, replay historico focal, QA e integracao com main); preview 38174397274 SUCCESS; CodeQL 38174397265 SUCCESS. SQL executado apenas em PostgreSQL descartavel de CI.
- QA_REVIEWER: APPROVE, revisao read-only de 11/10/2026 18:06 BRT no commit 7b41989; P1 isolamento e P2 autosave em navegacao resolvidos. Nenhum P0/P1/P2 bloqueante no delta.
- ACCESSIBILITY_UI_REVIEWER: APPROVE, revisao read-only de 11/10/2026 no commit 7b41989; P2 foco e P2 vinculos de erros resolvidos, Playwright 7/7; nenhum P1/P2 bloqueante no escopo.
- RISCOS_P3_NAO_BLOQUEANTES: mensagens dos controles invalidos ainda compartilham a descricao geral dos erros da equipe; faltam inspecoes visuais especificas de zoom 200%, sobreposicao/recorte, contraste de todos os estados, prefers-reduced-motion e casos extremos de escalacao. Fechamento abrupto ou recarga completa antes do debounce nao tem a mesma garantia de persistencia verificada na navegacao interna; beforeunload oferece protecao limitada. A revisao focal nao e auditoria WCAG integral.
- ESTADO: Etapa 5 aprovada no delta revisado, com write lock liberado; sem novos REQUEST_CHANGES de QA/acessibilidade. Nenhuma migration aplicada no Supabase compartilhado, sem merge, producao ou inicio da Etapa 6. Documento de fechamento e commit posterior nao alteram o codigo revisado.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer, mediante abertura de nova unidade para Etapa 6.
ARQUIVO_OU_SERVICO: docs/plan/sumula-manual-v2/06-lancamento-rapido-pontos.md e app/modules/scoresheet/.
ACAO: antes de qualquer desenvolvimento da Etapa 6, reconciliar Git/HANDOFF/PR #72, adquirir novo write lock e implementar apenas a unidade aprovada do lancamento rapido conforme o plano, preservando os riscos P3 para cobertura adicional quando aplicavel. PR segue DRAFT, sem merge ou migration em Supabase compartilhado.
CRITERIO_DE_CONCLUSAO: checkpoint da Etapa 5 versionado e publicado na PR #72 com evidencias e pareceres no SHA 7b41989; proxima unidade possui escopo proprio, testes e revisoes proporcionais.
