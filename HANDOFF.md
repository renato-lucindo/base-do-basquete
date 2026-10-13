# HANDOFF — Base do Basquete

> Checkpoint operacional para retomada. Histórico detalhado pertence ao Git, às PRs e a `docs/execution/`; não registre segredos aqui.

## 1. Estado vigente

**Checkpoint atual: QA isolado concluído e aprovado por banco/QA em94f4825; SQL1.418 assertivas no QA/restaurado e Auth/MFA reais passaram. ProjetoQA payumtvegfqfejmowxiy; compartilhado preservado62 migrations. Estado vigente na seção41. PR72 OPEN/DRAFT; integração/rollout pendentes, sem merge ou produção.**

A feature `MANUAL-SCORESHEET-V2-FIBA2024` segue na branch remota `codex/manual-scoresheet-v2` e PR draft #72, com worktree `manual-stage4-v3-review`. As unidades das Etapas 8 e 9 foram concluídas; a entrega documental `MANUAL-SCORESHEET-V2-STAGE10-GATE` foi concluída, com integração pendente. O objetivo geral é implementar a súmula manual v2 para transcrição pós-jogo em desktop, com criação transacional do jogo somente na confirmação, roster/estrelas/capitão/equipe técnica, oficiais, entrada rápida de pontos e faltas FIBA 2024, revisão versionada com concorrência otimista, rascunho local e acessibilidade por teclado.

A branch foi aberta originalmente em `b663b7acf1be3ce5463468a17613ae983bbe5a26` e foi reconciliada com `origin/main@8ac62209a636be757d96270eef9dc6b27c8735c0` pelo merge `6beb49c`, que integrou a governança documental da PR #71. O conflito ficou restrito a este arquivo; a resolução adotou o novo formato compacto do handoff.

## 2. WRITE_LOCK

```text
WRITE_LOCK:
OWNER: project-maintainer
WORK_UNIT: MANUAL-SCORESHEET-ISOLATED-QA
BRANCH: codex/manual-stage4-v3-review (worktree local; upstream origin/codex/manual-scoresheet-v2, PR #72)
BASE_COMMIT: bf703423046fe76682b6fdaa4177e00799e2b44d
HEAD_COMMIT: consultar Git; artefato revisado94f482529878dd625f8dd139002e5964e81e57d5; delta final somente registro documental
HEAD_FUNCIONAL: 80a33355d98dc351214d825557323fa29ebf957b; quatro pareceres válidos por domínio e QA local autorizado
SCOPE: provisionar projeto Supabase Free separado, aplicar schema somente nele e executar QA/recuperação com fixtures sintéticas; evidências/revisões na PR72
SCOPE_NEGATIVO: sem criação de atleta pela súmula, OCR/parser genérico, alteração dos contratos de importação PDF, conflito com boxscore, Supabase compartilhado, merge final ou produção nesta unidade
REQUIRED_REVIEWERS: database-security-reviewer, qa-reviewer (ambiente isolado; demais domínios funcionais inalterados)
STATUS: RELEASED
```

As quatro especialidades aprovaram o artefato funcional final da Etapa 9; o QA renovado aceita a execução local autorizada (seção 35). Os registros de etapas anteriores são históricos. O check remoto permanece falho por cobrança; não há autorização de merge neste gate documental.

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

## 26. Etapa 6 — lançamento rápido de pontos (11/10/2026)

WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE6-FAST-SCORING; BRANCH=codex/manual-stage4-v3-review (remoto: codex/manual-scoresheet-v2; PR #72 DRAFT); BASE_COMMIT=6dd5c57a4990148c3ac6c74466c1fc8a1177b151; HEAD_COMMIT=6dd5c57a4990148c3ac6c74466c1fc8a1177b151; STATUS=ACTIVE; SCOPE=wizard etapa Lançamentos, pontos 1/2/3 com entrada por teclado, camisa 00 literal, foco, Esc, Ctrl+Z, histórico local curto, grade de correções, estado persistido no rascunho, testes e gate. EXCLUSO=Etapas 7–10, faltas rápidas, migrations/Supabase compartilhado, merge main e produção.

Objetivo: completar o checkpoint de docs/plan/sumula-manual-v2/06-lancamento-rapido-pontos.md. Critérios de aceite: fluxo 12 Enter 2 Enter, seleção prévia de equipe/período, validação, foco restaurado, feedback acessível, undo limitado e grade editável sem servidor; testes focais e gate no código final, publicação na PR draft e revisão proporcional. O estado inicial foi reconciliado: worktree limpo, HEAD 6dd5c57, etapas 4 e 5 encerradas. O script auxiliar inspect-work-unit.mjs falhou com TypeError ao ler stderr indefinido; git status/log foram verificados diretamente.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: app/modules/scoresheet/setup-wizard.tsx, setup-state.ts, novo painel de pontos e testes; PR #72
ACAO: implementar lançamento rápido e histórico local, executar testes/CI, registrar review packet, fazer commit/push e verificar checks sem merge/migration compartilhada.
CRITERIO_DE_CONCLUSAO: entrada completa pelo teclado, rascunho restaurável e edição da grade testados, gate verde e HEAD da PR rastreado; write lock liberado após revisão.

### REVIEW_PACKET — Etapa 6 / código publicado (11/10/2026)

- WORK_UNIT: MANUAL-SCORESHEET-V2-STAGE6-FAST-SCORING.
- BRANCH: codex/manual-stage4-v3-review (remoto codex/manual-scoresheet-v2, PR #72 OPEN/DRAFT).
- BASE_COMMIT: 6dd5c57a4990148c3ac6c74466c1fc8a1177b151.
- HEAD_COMMIT: 37edaeecc72f5654f9e6accd268e9da1753906b0 (commit de código da Etapa 6; o HEAD documental posterior não altera o artefato).
- OBJETIVO: lançar conversões de LL/2P/3P exclusivamente pelo teclado após escolher equipe/período, permitindo correções na grade, desfazer e rascunho local restaurável.
- CRITERIOS_DE_ACEITE: 12 Enter 2 Enter, camisa 00 literal, só 1/2/3 pontos, Esc, Ctrl+Z, foco automático, feedback acessível, histórico de até 10 lançamentos, separação por equipe/período, grade editável, persistência sem servidor e reflow em 320px.
- ESCOPO: painel de lançamentos, setup-state/wizard, fixture e E2E, responsividade CSS.
- ESCOPO_NEGATIVO: Etapas 7–10, faltas rápidas, banco ou migrations do Supabase compartilhado, alterações no backend/RLS/RPC, merge main e produção.
- ARQUIVOS_ALTERADOS: app/modules/scoresheet/fast-scoring-panel.tsx e .test.ts; setup-state.ts e .test.ts; setup-wizard.tsx; app/app.css; e2e/fixtures/manual-scoresheet-setup.fixture.tsx; e2e/manual-scoresheet-setup.spec.ts; HANDOFF.md (checkpoint documental).
- MIGRATIONS: nenhuma nova, nenhuma aplicada ao Supabase compartilhado.
- AMBIENTE_VALIDADO: worktree Windows, navegador Playwright da fixture, builds locais e PostgreSQL descartável nos workflows GitHub Actions; sem execução no Supabase compartilhado.
- RISK_LEVEL: MODERADO. RISK_JUSTIFICATION: somente componentes de UI/estado de rascunho no localStorage e CSS; sem escrita servidor, autoridade estatística do banco, privilégios, contratos de ingestão, autenticação ou migrations. Consequências são limitadas ao rascunho local e à experiência de digitação; revisão de banco e estatística CRITICA não é acionada por este delta.
- REVIEW_DECISIONS: accessibility-ui-reviewer=REQUIRED (Playwright focal verifica foco, Esc, teclado, axe, labels, anúncios e viewport 320px); qa-reviewer=REQUIRED (Vitest de estado/histórico e fluxo E2E, draft restaurado, edição na grade, gate completo e CI); database-security-reviewer=WAIVED (nenhum código de servidor, autorização, SQL, migration, grants ou RLS); statistics-domain-reviewer=WAIVED (não altera fórmulas, agregações ou autoridades persistentes; campos de conversões já existentes); boxscore-domain-reviewer=WAIVED (parser/contratos/importadores inalterados); performance-investigator=WAIVED (sem alteração backend, consultas ou trabalho pesado novo). Revisão independente focal acionada para a interação de teclado/undo; automação complementa os pareceres, sem inventar aprovação.
- REQUIRED_REVIEWERS: accessibility-ui-reviewer e qa-reviewer neste delta de interação de teclado/undo; nenhum especialista CRITICO de banco/estatística acionado. REVIEW_APPROVER: project-maintainer, responsável pelo write lock e classificação de risco.
- TESTES_EXECUTADOS: gate local npm run check PASS em 11/10/2026 (format, lint sem erros bloqueantes, typecheck, Vitest 61 arquivos/512 testes, runbooks/agentes, build client/SSR, varredura de segredos em 745 arquivos); Playwright focal 10/10 PASS (entrada, 00, undo/edição, rascunho, axe, keyboard e 320/390/720/1280px); git diff --cached --check PASS antes do commit funcional. Nenhuma migration local de Stage 6.
- EVIDENCIAS: código 37edaee publicado em 11/10/2026; CI https://github.com/renato-lucindo/base-do-basquete/actions/runs/38178193565 ; Stage 4 Validation (pgTAP descartável) https://github.com/renato-lucindo/base-do-basquete/actions/runs/38178189299 ; Preview https://github.com/renato-lucindo/base-do-basquete/actions/runs/38178193535 ; CodeQL https://github.com/renato-lucindo/base-do-basquete/actions/runs/38178193534 (todos os quatro workflows concluíram SUCCESS em 11/10/2026 no SHA funcional 37edaee; Stage 4 Validation executou pgTAP/upgrade histórico em PostgreSQL descartável; CI incluiu gate, database, accessibility e remote_history_upgrade).
- RISCOS_CONHECIDOS: acessibilidade de uma interação de dois estágios e reversão de mudanças exige revisão independente focal; risco de estado local, reflow e perda por fechamento abrupto limitado ao navegador.
- WAIVERS/RISCOS_RESIDUAIS: histórico Ctrl+Z mantém somente os últimos 10 eventos nesta montagem e é zerado após edição manual/reload; localStorage possui debounce e pode perder último evento em fechamento abrupto; teste axe na fixture não substitui auditoria WCAG integral/zoom 200%; interface prepara conversões locais sem submissão autoritativa, prevista para etapa posterior. Riscos P3 não bloqueantes, sem extrapolar escopo.
- WRITE_LOCK_OWNER: project-maintainer (ACTIVE até verificar GitHub Actions e versionar o HANDOFF de encerramento).

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer.
ARQUIVO_OU_SERVICO: GitHub Actions do código 37edaee, PR #72, HANDOFF.md.
ACAO: conferir conclusão dos quatro workflows no SHA funcional, investigar falhas se houver, registrar resultados reais neste HANDOFF e comentário de revisão na PR, commit/push documental, verificar branch sincronizada e liberar write lock. Não iniciar Etapa 7.
CRITERIO_DE_CONCLUSAO: checks CI/pgTAP/preview/CodeQL concluídos sem bloqueio no artefato aprovado; PR OPEN/DRAFT; HANDOFF publicado com SHA e próxima ação concreta; worktree limpo e sincronizado.

### Revisão independente do SHA 37edaee — bloqueio focal de acessibilidade (11/10/2026)

- QA independente (Kant, 01a12cf7-43f1-7ca2-b51e-dc6fd3db4d31): APPROVE_WITH_NON_BLOCKING_NOTES; BASE_COMMIT=6dd5c57; COMMIT_REVISADO=37edaee; REVIEWED_AT=11/10/2026. Nenhum P0/P1 funcional; P3 cobertura de limite de 10 eventos/troca de contexto, localStorage 400ms e zoom 200%. Nota de escopo: a grade existente ainda exibe edição de faltas, enquanto lançamento rápido de faltas pertence à Etapa 7.
- Acessibilidade independente (Pauli, 01a12cf7-3955-7c11-af30-5110debeb13b): REQUEST_CHANGES; BASE_COMMIT=6dd5c57; COMMIT_REVISADO=37edaee; REVIEWED_AT=2026-10-11T19:03:54-03:00. P2 conflito de foco no início/restauração de Lançamentos entre RAF do wizard (setup-wizard.tsx:158) e RAF automático do painel (fast-scoring-panel.tsx:94-100); exige foco inicial no título e teste Playwright na transição/restauração. P3 switchContext muda imediatamente foco dos seletores para camisa, interrompendo uso das setas. Revisor realizou inspeção read-only; tentou testes locais, bloqueados por EPERM de spawn/test-results, mas verificou os quatro workflows remotos SUCCESS.
- GATES REMOTOS CONFIRMADOS no 37edaee: CI 38178193565 SUCCESS (accessibility/database/gate/remote_history_upgrade); Stage 4 Validation 38178189299 SUCCESS (security+statistics pgTAP, focused remote-history, QA); Preview 38178193535 SUCCESS; CodeQL 38178193534 SUCCESS. Banco somente PostgreSQL descartável de CI.
- TENTATIVA DE CORRECAO: uma primeira edição local via PowerShell falhou antes da gravação ao procurar contexto CRLF em arquivo com LF; verificação posterior confirmou arquivo inalterado. A tentativa corrigida foi recusada pela revisão automática da ferramenta com 'blocked by OpenAI because we could not determine the safety status of the request'. Correção P2 não foi aplicada. Não atribuir o erro a teste ou ao projeto.
- REVIEW_DECISIONS atuais: accessibility-ui-reviewer=REQUIRED, parecer REQUEST_CHANGES bloqueante; qa-reviewer=REQUIRED, APPROVE_WITH_NON_BLOCKING_NOTES válido apenas para 37edaee; demais waivers limitados ao delta de UI. STATUS: BLOCKED_REVIEW, WRITE_LOCK_OWNER=project-maintainer (ACTIVE); Stage 6 ainda não está encerrada, PR #72 OPEN/DRAFT.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer, após autorização aceita pela revisão da ferramenta.
ARQUIVO_OU_SERVICO: app/modules/scoresheet/fast-scoring-panel.tsx; e2e/manual-scoresheet-setup.spec.ts; PR #72/HANDOFF.md.
ACAO: suprimir o autofocus do painel na montagem para preservar o foco do título, manter foco no seletor ao alternar equipe/período, adicionar E2E para foco na transição e após restauração, rodar teste focal e gate aplicável, commit/push na branch da PR e obter nova revisão independente de acessibilidade no novo SHA.
CRITERIO_DE_CONCLUSAO: P2 formalmente corrigido e revogado por novo parecer, testes e quatro workflows verdes no SHA corrigido, revisão QA incremental quando aplicável, HANDOFF de encerramento publicado, write lock liberado; sem merge/main, Etapa 7, produção ou migrations compartilhadas.

### Correção verificada de foco — Etapa 6 (11/10/2026)

- WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE6-FAST-SCORING; BRANCH=codex/manual-stage4-v3-review (remoto origin/codex/manual-scoresheet-v2); HEAD_COMMIT=b136032140af9409d07e682860435825adfb7a2a; STATUS=ACTIVE. Escopo restrito à correção do foco e regressões da Etapa 6. PR #72 continua OPEN/DRAFT.
- Commit funcional publicado: `b136032140af9409d07e682860435825adfb7a2a` (`fix(scoresheet): preserve focus through scoring stage transitions`). Alterados somente `app/modules/scoresheet/fast-scoring-panel.tsx` e `e2e/manual-scoresheet-setup.spec.ts`; não houve migration, operação no Supabase compartilhado, merge em main ou deploy em produção.
- Correção P2: o `FastScoringPanel` só movimenta o foco quando a máquina de estados realmente muda de estágio; ao montar/restaurar, o foco inicial permanece no heading `Lançamentos` controlado pelo wizard. Após confirmar pontos, o foco volta à camisa já habilitada. Correção P3: mudança de equipe/período cancela a entrada parcial, limpa os campos e preserva o foco do seletor inclusive quando se aguardava o valor.
- Evidências locais em `b136032`: Playwright focal **10/10 PASS** com asserções explícitas de foco após navegação/restauração, após lançamento e ao alterar equipe/período (inclusive durante entrada parcial), erro, Esc, undo, axe e largura 320px. Vitest focal **9/9 PASS**. `npm run check` **PASS**: formatação, lint (avisos não bloqueantes preexistentes), typecheck, Vitest **61 arquivos/512 testes**, runbooks, agentes, build client/SSR e scan de segredos **745 arquivos**. `git diff --cached --check` PASS antes do commit. Primeira tentativa do gate encontrou `.last-run.json` gerado pelo Playwright; os artefatos de teste foram preservados em `%TEMP%/bdb-stage6-test-results-20261011-1909` e o gate foi reexecutado com sucesso.
- GitHub Actions no commit funcional `b136032`: CI `38179621473` **COMPLETED/SUCCESS** (`gate`, `database`, `accessibility`, `remote_history_upgrade`); Stage 4 Validation `38179619308` **COMPLETED/SUCCESS** (`Security + statistics (pgTAP)`, `Remote-history upgrade (focused pgTAP)`, `QA (build, tests, accessibility)`); preview `38179621472` **COMPLETED/SUCCESS**; CodeQL `38179621477` **COMPLETED/SUCCESS**. Todos os bancos dos workflows são descartáveis, sem operação no Supabase compartilhado. Evidências: `https://github.com/renato-lucindo/base-do-basquete/actions/runs/38179621473`, `https://github.com/renato-lucindo/base-do-basquete/actions/runs/38179619308`, `https://github.com/renato-lucindo/base-do-basquete/actions/runs/38179621472`, `https://github.com/renato-lucindo/base-do-basquete/actions/runs/38179621477`.
- Revisões: o parecer anterior `accessibility-ui-reviewer=REQUEST_CHANGES` de `37edaee` segue **formalmente aberto** até reavaliação independente no novo SHA; `qa-reviewer=APPROVE_WITH_NON_BLOCKING_NOTES` de `37edaee` necessita validade incremental para o novo teste/código. Tentativa de descobrir/invocar a revisão independente via ferramenta de agentes foi rejeitada pela revisão automática da plataforma (`blocked by OpenAI because we couldn't determine the safety status of the request`); nenhum novo parecer foi produzido. Não atribuir aprovação fictícia e não liberar o write lock.
- REVIEW_PACKET incremental: BASE_COMMIT=`6dd5c57`; CODE_HEAD=`b136032`; RISK_LEVEL=MODERADO (foco e E2E do wizard sem mudança de autoridade, fórmula, servidor, segurança, migrations ou contratos de ingestão). REQUIRED_REVIEWERS=`accessibility-ui-reviewer` para levantar REQUEST_CHANGES e QA incremental conforme contrato da unidade existente; demais especialistas permanecem WAIVED somente para este delta visual. REVIEW_APPROVER=`project-maintainer`, sem autoaprovação dos pareceres pendentes.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer.
ARQUIVO_OU_SERVICO: GitHub Actions para `b136032`, PR #72 e `.agents/accessibility-ui-reviewer.md` / `.agents/qa-reviewer.md`.
ACAO: obter novo parecer independente read-only de acessibilidade para P2/P3 do commit `b136032` e confirmação incremental de QA; registrar ambos no REVIEW_PACKET da PR #72/HANDOFF e somente após eliminação formal de bloqueios liberar WRITE_LOCK. Quatro workflows do código já concluídos com sucesso. Não iniciar Etapa 7 nem alterar Supabase compartilhado/main/produção.
CRITERIO_DE_CONCLUSAO: testes e checks do SHA final verdes, novo parecer de acessibilidade válido sem REQUEST_CHANGES, QA válido, REVIEW_PACKET atualizado na PR, worktree sincronizado e WRITE_LOCK liberado para uma unidade posterior.

## 27. Encerramento da Etapa 6 — revisoes independentes (11/10/2026)

- WORK_UNIT: MANUAL-SCORESHEET-V2-STAGE6-FAST-SCORING. BASE_COMMIT=6dd5c57a4990148c3ac6c74466c1fc8a1177b151; COMMIT_REVISADO=b136032140af9409d07e682860435825adfb7a2a; HEAD documental anterior=fc91326323029903a3586b9f84604c05daf9c4c8.
- Acessibilidade (Pauli, 01a12cf7-3955-7c11-af30-5110debeb13b): APPROVE_WITH_NON_BLOCKING_NOTES; REVIEWED_AT=2026-10-11T19:54:01-03:00, no b136032. P2 de foco do heading na entrada/restauracao e P3 de foco dos seletores corrigidos. REQUEST_CHANGES do 37edaee revogado por este parecer independente. Git diff --check PASS, git status limpo. Tentativa local Playwright bloqueada pelo ambiente (spawn EPERM antes do teste); evidencias CI e inspecao do diff confirmadas.
- QA (Kant, 01a12cf7-43f1-7ca2-b51e-dc6fd3db4d31): APPROVE_WITH_NON_BLOCKING_NOTES incremental, REVIEWED_AT=11/10/2026 (America/Sao_Paulo), COMMIT_REVISADO=b136032. Sem novo P0/P1, foco corrigido. Vitest local na revisao nao iniciou por spawn EPERM; evidencias remotas verificadas. Git status limpo antes/depois.
- Gates anteriores no b136032: npm run check PASS (61 arquivos/512 Vitest, lint, formatacao, tipos, build, segredos), Playwright focal 10/10 PASS. Actions b136032: CI 38179621473, Stage4 Validation/pgTAP 38179619308, Preview 38179621472, CodeQL 38179621477, todos SUCCESS. No HEAD documental fc91326: CI 38180117005, Stage4 Validation 38180114249, Preview 38180116980, CodeQL 38180116988, todos SUCCESS. PostgreSQL apenas descartavel no CI.
- Riscos residuais P3: seletores por setas nao simulados diretamente no E2E, zoom 200%, leitores de tela/contraste extremo, debounce localStorage e historico de undo limitado. REVIEW_DECISIONS: accessibility-ui-reviewer e qa-reviewer APPROVE_WITH_NON_BLOCKING_NOTES; demais especialistas WAIVED apenas no diff UI da Etapa 6; REVIEW_APPROVER=project-maintainer. Gate da Etapa 6 PASS.
- WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE6-FAST-SCORING; BRANCH=codex/manual-stage4-v3-review (remote origin/codex/manual-scoresheet-v2); STATUS=RELEASED; SCOPE=Etapa 6 concluida e revisada. PR #72 OPEN/DRAFT, sem merge, Supabase compartilhado ou producao.
- PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=docs/plan/sumula-manual-v2/07-lancamento-rapido-faltas.md, app/modules/scoresheet/ e PR #72; ACAO=publicar fechamento, abrir unidade Stage7 independente com write lock e implementar/parser FIBA 2024 + testes; CRITERIO_DE_CONCLUSAO=12U2/12 U2, GD, equipe/periodo, faltas de banco sem atleta artificial e feedback acessivel cobertos por testes, commits e CI na PR draft.

## 28. Etapa 7 — lançamento rápido de faltas (11/10/2026)

WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE7-FAST-FOULS; BRANCH=codex/manual-stage4-v3-review (remoto origin/codex/manual-scoresheet-v2, PR #72 DRAFT); BASE_COMMIT=50cee7532df6e37372ffd69f1e09db1e90314d7c; HEAD_COMMIT=084180459297dee52310f5ccdd6600029fc7439e (artefato funcional da Etapa 7); STATUS=ACTIVE; SCOPE=integracao UI do parser FIBA 2024 ja implementado, faltas por equipe/periodo, GD, alvo atleta/banco/comissao, rascunho local, mensagens acessiveis, testes focais e gate; EXCLUSO=Etapas 8-10, Supabase compartilhado/migrations remotas, merge main, deploy producao.

Objetivo/aceite: entradas 12U2, 12 U2 e minusculas aceitas; GD por tipo de falta impede novas faltas do atleta; pontos no mesmo periodo continuam permitidos sem cronologia global; faltas de banco/comissao nao fabricam atleta; eventos semanticos persistem no rascunho e feedback de sucesso/erro acessivel. Somente project-maintainer escreve nesta unidade. Avaliar o diff quanto a risco FIBA/estatistica, acessibilidade e QA e solicitar pareceres independentes obrigatorios quando acionados; nao atribuir aprovacao sem execucao.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=app/modules/scoresheet/fast-scoring-panel.tsx, setup-state.ts, setup-wizard.tsx e testes; ACAO=implementar fluxo de faltas usando parseFastFoulEntry/evaluateDisqualification, rodar testes e gate, produzir REVIEW_PACKET com evidencias por SHA, publicar commits e verificar PR #72; CRITERIO_DE_CONCLUSAO=cenarios FIBA/GD, banco/comissao, restauracao e acessibilidade aprovados por testes e revisoes requeridas, worktree sincronizado e lock liberado. Nenhuma migration compartilhada, merge ou producao.

### REVIEW_PACKET — Etapa 7 / código 0841804 (11/10/2026)

- WORK_UNIT: MANUAL-SCORESHEET-V2-STAGE7-FAST-FOULS.
- BRANCH: codex/manual-stage4-v3-review; upstream origin/codex/manual-scoresheet-v2; PR #72 OPEN/DRAFT no último estado confirmado.
- BASE_COMMIT: 50cee7532df6e37372ffd69f1e09db1e90314d7c.
- HEAD_COMMIT: 084180459297dee52310f5ccdd6600029fc7439e, commit `feat: add FIBA 2024 quick foul entry`, anteriormente enviado ao upstream. Commits exclusivamente documentais posteriores não alteram o artefato revisável.
- OBJETIVO: disponibilizar lançamento rápido de faltas FIBA 2024 por equipe/período com GD, sem inventar atleta para faltas de banco/comissão, com rascunho restaurável.
- CRITERIOS_DE_ACEITE: aceitar `12U2`, `12 U2` e minúsculas; preservar camisa `00`; tratar alvos atleta, banco, técnico e assistente; indicar D/2T/2U/T+U, impedir falta após GD inclusive retroativa, manter pontuação permitida no mesmo período e rejeitar a de períodos posteriores sem cronologia global; validar restauração, mensagens e teclado.
- ESCOPO: somente UI e estado local da súmula, grade compacta, validação de draft e testes.
- ESCOPO_NEGATIVO: Etapas 8–10; autoridade persistida no servidor; migrations/SQL remotos; Supabase compartilhado; merge main; deploy produção.
- ARQUIVOS_ALTERADOS NO COMMIT FUNCIONAL: `app/modules/scoresheet/compact-grid.tsx`, `fast-scoring-panel.tsx`, `fast-scoring-panel.test.ts`, `setup-state.ts`, `setup-state.test.ts`, `setup-wizard.tsx` e `e2e/manual-scoresheet-setup.spec.ts`.
- MIGRATIONS: nenhuma criada ou aplicada nesta etapa.
- TESTES_EXECUTADOS (evidência da execução anterior neste mesmo SHA): Vitest focal 58/58 PASS; Playwright Chromium focal 12/12 PASS (códigos FIBA, GD, alvo, teclado, feedback e draft); `npm run check` PASS (format, lint com avisos informativos preexistentes, typecheck, Vitest 61 arquivos/517 testes, runbooks/agents, build client/SSR e secret scan em 745 arquivos); `git diff --cached --check` PASS antes do commit 0841804. Não repetir gate integral por alteração somente documental.
- EVIDENCIAS: código 0841804; CI `https://github.com/renato-lucindo/base-do-basquete/actions/runs/38185744902`; Stage 4 Validation/pgTAP em PostgreSQL descartável `https://github.com/renato-lucindo/base-do-basquete/actions/runs/38185740857`; Preview `https://github.com/renato-lucindo/base-do-basquete/actions/runs/38185744920`; CodeQL `https://github.com/renato-lucindo/base-do-basquete/actions/runs/38185744914`. Esses workflows estavam IN_PROGRESS na última consulta anterior; conclusão **não verificada** neste checkpoint: consulta remota `gh run list`/`gh pr view` recusada pela revisão automática de segurança da plataforma. Não atribuir SUCCESS sem nova evidência.
- AMBIENTE_VALIDADO: worktree Windows, Vitest e Playwright local; pgTAP configurado no GitHub Actions para PostgreSQL descartável, conclusão atual ainda sem evidência. Nenhuma execução no Supabase compartilhado.
- RISK_LEVEL: CRITICO. RISK_JUSTIFICATION: interpretação de faltas FIBA e desqualificação altera semântica de evento e elegibilidade de estatísticas locais. Embora este delta não altere fórmula de read model no servidor ou ingestão de boxscore, o contrato FIBA e a semântica estatística de desqualificação precisam de avaliação especializada independente.
- REVIEW_DECISIONS: `boxscore-domain-reviewer=REQUIRED` (semântica FIBA 2024, faltas, penalidade e GD); `statistics-domain-reviewer=REQUIRED` (isolamento das faltas por equipe/período, bloqueio pós-GD e pontos por período); `qa-reviewer=AUTOMATED` (Vitest 517 e Playwright 12/12 do SHA funcional, com validação CI final pendente); `accessibility-ui-reviewer=AUTOMATED` (Playwright cobre teclado, foco, regiões status/erro e cenários responsivos, sem barreira crítica identificada nos testes); `database-security-reviewer=WAIVED` (sem backend, RLS, SQL ou migrations); `performance-investigator=WAIVED` (sem alterações de consulta/cache/worker ou desempenho crítico).
- REQUIRED_REVIEWERS: boxscore-domain-reviewer e statistics-domain-reviewer, **ambos PENDENTES**, sem parecer independente válido no commit 0841804. Não substituir por avaliação do próprio autor ou pelo CI.
- WAIVERS/RISCOS_RESIDUAIS: QA/acessibilidade automatizados limitados aos cenários cobertos, sem auditoria WCAG integral; estado local não publicado no backend; critérios de sequência por período não impõem cronologia intra-período. As dispensas não removem obrigatoriedade de revisão CRITICA. Nenhum incidente de Supabase ou serviço remoto foi observado.
- REVIEW_APPROVER: project-maintainer, responsável por selecionar revisores, documentar a automação/dispensas e exigir os pareceres críticos antes de liberar o lock.
- WRITE_LOCK_OWNER: project-maintainer; STATUS=ACTIVE, bloqueado para encerramento por revisões obrigatórias pendentes e conclusão dos Actions ainda não confirmada.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer.
ARQUIVO_OU_SERVICO: `.agents/boxscore-domain-reviewer.md`, `.agents/statistics-domain-reviewer.md`, PR #72 e GitHub Actions nos quatro runs indicados acima.
ACAO: obter pareceres independentes read-only no SHA funcional 0841804, verificar resultados finais de CI/pgTAP/Preview/CodeQL e tratar eventuais achados; publicar este REVIEW_PACKET em comentário ou descrição da PR, versionar HANDOFF e conferir sincronização do worktree. Se a plataforma mantiver o bloqueio de consultas GitHub, registrar a limitação e aguardar liberação explícita sem tentar burlar a recusa.
CRITERIO_DE_CONCLUSAO: ambos os pareceres críticos válidos sem bloqueios, checks do SHA funcional verificados, documentação e PR rastreáveis, worktree sincronizado; só então liberar WRITE_LOCK e abrir Etapa 8. Sem migrations no Supabase compartilhado, merge main ou deploy produção.

### Verificacao remota Stage 7 apos checkpoint 997d3ae (11/10/2026)

- HEAD de codigo preservado: 084180459297dee52310f5ccdd6600029fc7439e. HEAD documental de referencia: 997d3ae7a06d664785f504502a8a5f4c624034ed. Worktree inicialmente limpo/sincronizado com origin/codex/manual-scoresheet-v2; PR #72 OPEN/DRAFT e mergeable.
- Checks de GitHub Actions no commit documental 997d3ae: CI 38186145662 SUCCESS (gate, acessibilidade, database e remote_history_upgrade); Stage 4 Validation 38186141185 SUCCESS (seguranca/estatisticas pgTAP, replay, QA e integracao); Preview 38186145659 SUCCESS; CodeQL 38186145816 SUCCESS. pgTAP em PostgreSQL descartavel: 49 arquivos / 1408 testes PASS e replay historico 9 arquivos / 345 testes PASS. Gate CI e QA do Stage 4 Validation SUCCESS. Supabase Preview SKIPPED, sem operacao no banco compartilhado.
- No SHA funcional 0841804, CI 38185744902, Preview 38185744920 e CodeQL 38185744914 SUCCESS; Stage4 Validation 38185740857 CANCELLED por supersessao, com execucao completa SUCCESS no SHA documental 997d3ae, sem alteracao funcional.
- Revisao especializada FIBA/boxscore Stage 7 solicitada ao agente independente Banach (01a12d83-3038-7f40-9e05-88ae521a3a98), vinculada ao codigo 0841804; parecer formal ainda nao recebido. Revisao statistics-domain-reviewer nao iniciada: o runtime informou "collab spawn failed: agent thread limit reached". Encerramento de um agente historico concluido nao liberou vaga suficiente; outra tentativa de fechamento foi recusada pela revisao automatica de seguranca. A tentativa posterior de aguardar o parecer FIBA foi tambem recusada pela revisao automatica de seguranca. Nao inferir decisao a partir dessas tentativas.
- RISK_LEVEL=CRITICO; REVIEW_DECISIONS mantidas: boxscore-domain-reviewer=REQUIRED PENDING, statistics-domain-reviewer=REQUIRED PENDING, QA=AUTOMATED, acessibilidade=AUTOMATED, database-security e performance=WAIVED apenas no delta local/UI. Sem alteracao de codigo ou tests apos 0841804. WRITE_LOCK project-maintainer ACTIVE; Stage 7 NAO ENCERRADA e Etapa 8 NAO INICIADA; PR segue DRAFT, sem merge, migrations compartilhadas ou deploy de producao.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer.
ARQUIVO_OU_SERVICO: agentes independentes FIBA/boxscore e statistics-domain-reviewer; HANDOFF.md e PR #72.
ACAO: obter retorno formal do parecer FIBA solicitado; liberar capacidade de agentes somente quando autorizado pela ferramenta e obter parecer estatistico independente sobre 0841804; tratar eventuais P1/P2, rodar validacao focal ao mudar codigo e renovar pareceres afetados; registrar decisoes validas e checar Actions no SHA final.
CRITERIO_DE_CONCLUSAO: dois pareceres criticos validos sem bloqueios, checks concluidos SUCCESS no artefato funcional revisado, HANDOFF e PR atualizados, branch sincronizada e WRITE_LOCK liberado antes de abrir Etapa 8.
### Checkpoint de correcao da Etapa 7 — codigo 7a0f2b1 (11/10/2026)

- WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE7-FAST-FOULS; BRANCH=codex/manual-stage4-v3-review (upstream origin/codex/manual-scoresheet-v2); BASE_COMMIT=50cee7532df6e37372ffd69f1e09db1e90314d7c; HEAD_COMMIT=7a0f2b1f9f4c052fac86a93385ad564c73106149 (codigo funcional); STATUS=ACTIVE ate verificacao de revisoes e Actions. PR #72 OPEN/DRAFT antes deste checkpoint.
- Commit funcional criado localmente: `7a0f2b1 fix(scoresheet): reconcile legacy fouls and guard retroactive disqualification`. O delta altera `domain.ts`, `fast-scoring-panel.tsx` e seus testes, `setup-state.test.ts` e E2E; nenhuma migration ou banco compartilhado foi modificado. O worktree estava limpo e a branch estava um commit a frente de seu upstream antes da presente atualizacao documental.
- P1 corrigido: impede GD retroativa se o atleta registrou pontos em periodo posterior; preserva lancamentos permitidos no mesmo periodo. P2 corrigido: consolidacao de codigos legados da grade com faltas semanticas por atleta/equipe, sem deduplicacao indevida; celulas legadas incompletas sao identificadas. P2 corrigido: campo de falta parcial e limpo ao trocar equipe ou periodo.
- Verificacoes do codigo funcional: `git diff --check` e `git diff --cached --check` PASS; Vitest focal (2 arquivos/16 testes) PASS. Gate `npm run check` PASS (519 Vitest) e Playwright focal (13/13) PASS na sessao imediatamente anterior sobre o mesmo codigo, sem edicao funcional posterior. Gate integral nao repetido por politica de verificacao eficiente.
- REVIEW_PACKET: RISK_LEVEL=CRITICO; boxscore-domain-reviewer=REQUIRED; statistics-domain-reviewer=REQUIRED, ambos solicitados no HEAD funcional 7a0f2b1 e aguardando parecer formal neste checkpoint. QA=AUTOMATED por Vitest/E2E/CI, acessibilidade=AUTOMATED por assercoes de teclado/foco/status/erro e reflow; database-security=WAIVED pois nao ha alteracoes de servidor, banco, RLS, SQL ou migrations; performance=WAIVED pois nao ha mudancas em consulta, cache, Worker ou benchmark. REVIEW_APPROVER=project-maintainer. Nenhuma dispensa abrange os dois dominios criticos.
- PR/Actions: origin/codex/manual-scoresheet-v2 estava em 71020ad, antes do push desta correcao. Evidencias CI, Stage 4 Validation com pgTAP descartavel, Preview e CodeQL devem ser obtidas para o SHA publicado. Nenhuma migration remota sera aplicada, sem merge main/deploy producao.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer.
ARQUIVO_OU_SERVICO: .agents/statistics-domain-reviewer.md, .agents/boxscore-domain-reviewer.md, HANDOFF.md, PR #72 e GitHub Actions.
ACAO: colher os dois pareceres independentes sobre 7a0f2b1; corrigir e renovar revisoes se surgirem bloqueios; publicar commit de HANDOFF e push na branch da PR; consolidar REVIEW_PACKET e conferir CI, Stage 4 Validation/pgTAP, Preview e CodeQL no novo SHA. Liberar WRITE_LOCK somente com as aprovacoes criticas e checks reais verdes; Etapa 8 aguarda fechamento formal.
CRITERIO_DE_CONCLUSAO: revisoes criticas validas sem pendencias, testes e quatro workflows aprovados no SHA publicado, PR e HANDOFF sincronizados, git status limpo e WRITE_LOCK liberado.

### Correcao complementar da Etapa 7 — 6d45a96 (11/10/2026)

- WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE7-FAST-FOULS; BRANCH=codex/manual-stage4-v3-review, upstream origin/codex/manual-scoresheet-v2; BASE_COMMIT=50cee7532df6e37372ffd69f1e09db1e90314d7c; HEAD_COMMIT de codigo=6d45a963134d128064bb4132ff0a46808a55708d; STATUS=ACTIVE (revisoes independentes e Actions pendentes).
- Commit funcional `6d45a96 fix(scoresheet): repair legacy fouls and reconcile restored GD`: grade de faltas legadas voltou a oferecer entrada editavel com erro acessivel; faltas retroativas anteriores a GD sao aceitas apenas quando a sequencia total permanece consistente; restauracao reconcilia faltas legadas e eventos FIBA e rejeita GD com faltas ou pontos em periodos posteriores. Entradas legadas parcialmente preenchidas permanecem restauraveis para correcao, com novos lancamentos bloqueados ate a reparacao. Seis arquivos alterados, sem migrations.
- Evidencia local no mesmo codigo: Vitest focal 18/18 PASS; Playwright do wizard 15/15 PASS com teclado, axe, GD, retroatividade, reparacao na grade e responsividade; `npm run check` PASS (61 arquivos/521 testes Vitest, format, lint com avisos preexistentes nao bloqueantes, typecheck, runbooks, agentes, build client/SSR, scan de segredos 745 arquivos). `git diff --cached --check` PASS antes do commit. Artefato temporario `.last-run.json` do Playwright preservado em `%TEMP%/bdb-stage7-test-results-20261011-225731` para permitir o gate de formatacao.
- Pareceres independentes anteriores: boxscore-domain-reviewer Euler e statistics-domain-reviewer Erdos emitiram REQUEST_CHANGES focal no SHA `7a0f2b1` por falta legada inacessivel, bloqueio excessivo de retroatividade e restauracao inconsistente. Ambos sao historicos, nao aprovam `6d45a96`; novas revisoes independentes REQUIRED. RISK_LEVEL=CRITICO: FIBA e semantica estatistica de GD. QA e acessibilidade=AUTOMATED por cobertura Vitest/Playwright e gate local, sujeitas a comprovacao por Actions; database-security e performance=WAIVED por ausencia de diff SQL, migrations, RLS, Auth, servidor, Worker, consulta ou cache. REVIEW_APPROVER=project-maintainer, sem autoaprovacao especializada.
- No momento deste checkpoint, CI, Stage 4 Validation/pgTAP em PostgreSQL descartavel, Preview e CodeQL ainda nao foram verificados para `6d45a96`; push e review packet da PR pendentes. PR #72 OPEN/DRAFT; nenhum merge em main, deploy de producao ou operacao no Supabase compartilhado. A Etapa 8 permanece bloqueada.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer.
ARQUIVO_OU_SERVICO: GitHub PR #72, GitHub Actions (CI, Stage 4 Validation/pgTAP, Preview, CodeQL), `.agents/boxscore-domain-reviewer.md` e `.agents/statistics-domain-reviewer.md`.
ACAO: publicar o commit funcional `6d45a96` e este HANDOFF na branch remota da PR; publicar REVIEW_PACKET atualizado; obter dois novos pareceres independentes no SHA funcional, inspecionar os quatro Actions e registrar no HANDOFF os resultados reais e eventuais bloqueios. Manter PR DRAFT e WRITE_LOCK ativo enquanto houver pendencias.
CRITERIO_DE_CONCLUSAO: revisoes criticas validas sem REQUEST_CHANGES, quatro workflows SUCCESS no SHA publicado, pacote de revisao rastreavel na PR, branch sincronizada e worktree limpo. Nao fazer merge em main, migration no Supabase compartilhado ou iniciar Etapa 8.

### Evidencia remota consolidada da Etapa 7 e bloqueio de capacidade (11/10/2026)

- WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE7-FAST-FOULS; BASE_COMMIT=50cee7532df6e37372ffd69f1e09db1e90314d7c; HEAD_COMMIT_FUNCIONAL=6d45a963134d128064bb4132ff0a46808a55708d; HEAD_COMMIT_PUBLICADO_VALIDADO=16a443393cabc9e2f9a2540c66df2b7baa935f71 (somente HANDOFF depois do funcional). Branch origin/codex/manual-scoresheet-v2 sincronizada na verificacao; PR #72 OPEN/DRAFT.
- GitHub Actions para 16a4433, todos **SUCCESS**: CI #38194726315 (gate, database, accessibility e remote_history_upgrade), Stage 4 Validation #38194723055 (Security + statistics pgTAP, Remote-history upgrade, QA e Integration), Pull request preview #38194726253 e CodeQL #38194726257. URLs: https://github.com/renato-lucindo/base-do-basquete/actions/runs/38194726315 ; https://github.com/renato-lucindo/base-do-basquete/actions/runs/38194723055 ; https://github.com/renato-lucindo/base-do-basquete/actions/runs/38194726253 ; https://github.com/renato-lucindo/base-do-basquete/actions/runs/38194726257.
- Log de Stage 4 Validation: pgTAP principal **49 arquivos / 1.408 testes PASS**; reconstrução historica focal **9 arquivos / 345 testes PASS**; todos em PostgreSQL descartavel do Actions. Supabase Preview aparece SKIPPED como esperado. Nenhuma migration foi aplicada ao Supabase compartilhado; sem merge, deploy de producao ou Etapa 8.
- REVIEW_PACKET Stage 7 publicado em comentario da PR #72 (comentario GitHub #6116516374). RISK_LEVEL=CRITICO; boxscore-domain-reviewer e statistics-domain-reviewer continuam REQUIRED, QA e acessibilidade=AUTOMATED pelos testes no codigo e Actions; database-security e performance=WAIVED neste delta sem backend/SQL/RLS/Auth/Worker/cache. REVIEW_APPROVER=project-maintainer. Nenhum parecer independente valido no novo codigo ainda.
- Revisores read-only FIBA/boxscore e estatistica solicitados duas vezes para 6d45a96. Einstein/Confucius e Leibniz/Tesla encerraram em erro de capacidade do provedor: "Selected model is at capacity. Please try a different model." **Nenhum deles emitiu parecer**; os REQUEST_CHANGES historicos no 7a0f2b1 permanecem abertos formalmente ate pareceres validos sobre 6d45a96. WRITE_LOCK_OWNER=project-maintainer; STATUS=ACTIVE; Etapa 7 NAO ENCERRADA.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer.
ARQUIVO_OU_SERVICO: .agents/boxscore-domain-reviewer.md, .agents/statistics-domain-reviewer.md, PR #72, HANDOFF.md.
ACAO: obter dois pareceres independentes read-only completos (FIBA e estatistica) vinculados ao commit funcional 6d45a96 apos normalizacao da capacidade; corrigir eventuais achados e revalidar o delta; registrar vereditos e revisar o REVIEW_PACKET na PR. Confirmar que nao houve mudanca funcional apos os quatro Actions verdes. Somente se ambos aprovarem e nenhum gate estiver bloqueado, liberar WRITE_LOCK e documentar encerramento da Etapa 7. Manter PR OPEN/DRAFT, sem migration no Supabase compartilhado, merge na main ou Etapa 8.
CRITERIO_DE_CONCLUSAO: ambos pareceres criticos validos sem bloqueio, Actions SUCCESS no artefato funcional, HANDOFF/PR sincronizados, worktree limpo e write lock liberado.

## 29. Retomada — overtime condicionado a empate (11/10/2026)

WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE7-FAST-FOULS; BRANCH=codex/manual-stage4-v3-review (upstream origin/codex/manual-scoresheet-v2); BASE_COMMIT=50cee7532df6e37372ffd69f1e09db1e90314d7c; HEAD_INICIAL=fb114cfb7216da0afefe05365b4534d3c3e42202; STATUS=ACTIVE.

- Escopo autorizado: corrigir overtime no painel rápido, rascunho, grade, regras de GD e testes. OT1 depende de empate acumulado até Q4; OT seguinte depende de empate acumulado até o OT anterior. Preservar dados em correções posteriores e sinalizar inconsistências.
- Decisões do responsável: botão Adicionar OT até OT8; faltas agrupadas Q4/OT no período 4; GD nesse grupo permite transcrição dos pontos Q4/OT sem cronologia global, mantendo proibição de novas faltas após GD. GD em Q1–Q3 continua bloqueando pontos posteriores, inclusive OT.
- Estado reconciliado: worktree inicialmente limpo, GitHub PR #72 OPEN/DRAFT no fb114cf; CI 38195313231, Stage 4 Validation 38195309503, Preview 38195313289 e CodeQL 38195313370 SUCCESS. Supabase Preview SKIPPED. Nenhuma alteração remota nesta retomada.
- Risco CRITICO pela semântica GD/FIBA; revisores independentes statistics-domain e boxscore-domain REQUIRED. QA/acessibilidade por testes focais e Actions; sem alteração SQL/RLS/Auth/servidor. Pareceres anteriores não aprovam a nova correção.
- Próximo passo exato: implementar e testar pontuação OT, faltas Q4/OT e liberação por empate no painel/rascunho; rodar gate, publicar na branch da PR, verificar Actions/pgTAP descartável e obter revisões críticas no SHA final. Sem Supabase compartilhado, merge, produção ou Etapa 8.

### Delta de overtime pronto para gate local

- Decisão complementar explícita do responsável: exigir confirmação de período concluído, além do empate. Campo completedPeriods persistido no rascunho; versões anteriores recebem [] e periodCount=4, inferindo períodos com pontos já registrados. Alterar pontos/undo invalida confirmações do período afetado e posteriores; trocar atleta/equipe retira confirmações para nova conferência. Faltas Q4/OT mantêm o grupo 4 e não alteram essas confirmações de pontuação.
- Implementação local: Q1–Q4/OT1–OT8, contador compartilhado entre equipes, liberação por empate acumulado e confirmação Q4/OT anterior; correções preservam dados existentes e sinalizam inconsistências. GD em Q4/OT permite pontos do grupo sem cronologia global; GD Q1–Q3 impede pontos posteriores até OT8. Sem alteração em APIs/SQL/servidor; contrato autoritativo para integração da Etapa 8 registrado no plano.
- Testes focais: Vitest 4 arquivos/77 testes PASS; Playwright wizard 17/17 PASS com confirmação explícita + cenário focal adicional OT8/GD 1/1 PASS (18 cenários no total). Incluem axe, teclado, foco, 320/390/720/1280px, totais, undo, correções e restauração. Artefatos Playwright em TEMP, sem arquivos gerados no repositório.
- Gate consolidado e revisões críticas do novo SHA ainda pendentes. Próximo passo: executar npm run check, criar commit e publicar na branch da PR #72; obter pareceres independentes FIBA/estatística e verificar CI, pgTAP descartável, Preview e CodeQL. Não encerrar Etapa 7 antes dessas evidências.

- Gate local consolidado do delta OT: npm run check PASS (formatação, lint sem erros bloqueantes, typecheck, suíte Vitest, runbooks/agentes, build client/SSR e scan de segredos 747 arquivos). Nenhuma mudança funcional após esse gate. Totais exatos da suíte e SHA serão registrados no REVIEW_PACKET publicado. git diff --check PASS. QA/acessibilidade AUTOMATED pela cobertura focal e Actions ainda a verificar; FIBA/estatística REQUIRED, aguardando novo parecer independente no commit funcional.

### Revisões independentes de 571440e — correção adicional necessária

- statistics-domain-reviewer Nietzsche (01a12e14-2994-77b2-9b8e-101bf3c386f0): REQUEST_CHANGES em 571440e; Vitest 77/77 e Playwright 18/18 PASS. P1 reproduzido: alterar falta legada Q2 para D após pontos Q3 é aceito pela grade, mas a restauração rejeita a combinação e o wizard apaga o rascunho. Bloqueios anteriores de inacessibilidade e retroatividade excessiva considerados resolvidos; restauração ainda bloqueante nesse caminho. Corrigir antes de concluir Etapa 7.
- boxscore-domain-reviewer Aquinas (01a12e14-2aad-7453-82e8-84f02191c321): APPROVE_WITH_NON_BLOCKING_NOTES em 571440e; revogou os três bloqueadores FIBA anteriores de 7a0f2b1. Vitest 101/101 (inclui extração/parser/matching e quatro PDFs) e Playwright 18/18 PASS. Parecer requer validação incremental após correção P1.
- Revisões encerradas, HEAD 571440e preservado durante avaliação, worktree limpo antes de retomar correção. WRITE_LOCK project-maintainer continua ACTIVE. Preview 38198480833 SUCCESS com navegação, segurança/privacidade e acessibilidade pública/reflow; demais workflows ainda em acompanhamento. QA local adicional com CSS zoom 200% a 640px (conteúdo efetivo 320px), teclado/foco e axe PASS, zero violações e sem overflow horizontal; não substitui auditoria WCAG integral.
- Próximo passo: bloquear edições legadas que consolidem GD incompatível e impedir exclusão automática na restauração incompatível; cobrir recarga/restauração e reparação em E2E, executar gate aplicável e renovar pareceres no SHA corrigido.

### Correção P1 de perda do rascunho — pronta para gate

- Grade valida a sequência completa do atleta antes de consolidar falta legada: rejeita GD com faltas ou pontos posteriores, mantendo o valor anterior e exibindo erro textual associado ao campo. Entradas parciais continuam editáveis/restauráveis; Q4/OT e retroatividade válida preservados.
- Restauração incompatível mantém o rascunho e o aviso disponíveis, com formulário protegido contra sobrescrita; somente Descartar explicitamente exclui dados. Não relaxa validações de elencos/semântica/GD da restauração.
- Focal Vitest 78/78 PASS. Playwright: 17 cenários anteriores PASS; nova regressão de rejeição/recarga/restauração/reparação PASS e retenção de rascunho histórico incompatível PASS. A primeira execução do novo teste falhou por expectativa de slot 2; fixture real coloca Davi no slot 3, expectativa corrigida. Não foi falha do produto. Resultado focal dos três últimos cenários registrado antes do commit; total esperado 20.
- Actions do SHA anterior 571440e: CI 38198480763, Stage 4 Validation 38198478177, Preview 38198480833 e CodeQL 38198480856 SUCCESS. Essa evidência não substitui Actions do próximo SHA funcional.
- Próximo passo: gate local do delta P1, commit/push, REVIEW_PACKET e renovação incremental dos dois pareceres independentes. WRITE_LOCK ACTIVE; sem banco compartilhado, merge ou Etapa 8.

- Gate final do delta P1: npm run check PASS (62 arquivos/537 Vitest, format/lint sem erro bloqueante, typecheck, runbooks/agentes, build e segredos 747 arquivos). Playwright 20 cenários cobertos no mesmo código final: 17 anteriores PASS + três focais PASS após corrigir a expectativa do teste; Vitest focal 78/78 PASS; git diff --check PASS. Nenhuma alteração funcional após o gate. Novo SHA e revisões serão registrados após commit/push.

## 30. Fechamento técnico — overtime e GD / Etapa 7

- WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE7-FAST-FOULS; BASE_COMMIT=50cee7532df6e37372ffd69f1e09db1e90314d7c; HEAD_FUNCIONAL=ff77e5a7469f5501a505df66e2cb42113862f521; delta OT inicial=571440ebd2bc1217e2115fa9c9868e34ef8bed7d; BRANCH=codex/manual-stage4-v3-review, upstream origin/codex/manual-scoresheet-v2. O commit deste fechamento altera exclusivamente HANDOFF.md; consultar Git para o SHA documental.
- Resultado funcional: OT1 depende de Q4 explicitamente concluído e empate acumulado Q1–Q4. Cada OT seguinte exige confirmação e empate acumulado até o OT anterior, até OT8. Pontuação separada por período; faltas Q4/OT compartilham período 4 e sequência. GD em Q1–Q3 bloqueia pontos posteriores inclusive OT; GD Q4/OT permite pontos do grupo sem inferir cronologia e continua bloqueando novas faltas. Editar pontos/undo ou trocar elenco/equipe exige nova conferência das confirmações afetadas; períodos e dados OT são preservados.
- P1 complementar corrigido: grade rejeita alteração legada completa que consolidaria GD inconsistente com faltas/pontos posteriores; entradas parciais permanecem reparáveis. Rascunho incompatível preservado até Descartar explícito, com formulário protegido contra sobrescrita. Dados históricos incompatíveis ficam protegidos, porém não têm restauração editável pela interface (nota não bloqueante do revisor).
- Gate local final em ff77e5a: npm run check PASS, 62 arquivos/537 Vitest, formatação, lint sem erros bloqueantes, typecheck, runbooks/agentes, build client/SSR e scan de segredos 747 arquivos. Focal 78/78 PASS. Playwright do wizard: 20 cenários PASS no código final (17 anteriores + 3 focais após correção da expectativa de slot do teste); GitHub CI accessibility também SUCCESS. Teclado, foco, axe, 320/390/720/1280px, totais/undo, confirmação/restauração, Q4/OT e OT8 cobertos. QA adicional CSS zoom 200% a 640px, teclado/foco, zero violações axe e sem overflow em 571440e; delta posterior de erro/rascunho coberto pelos focais e revisão, sem alegação de conformidade WCAG integral.
- Revisão estatística independente: Nietzsche, 01a12e14-2994-77b2-9b8e-101bf3c386f0, APPROVE_WITH_NON_BLOCKING_NOTES, COMMIT_REVISADO=ff77e5a, REVIEWED_AT=2026-10-12T03:19:17Z. Revogou explicitamente P1 de perda do rascunho e REQUEST_CHANGES anterior; bloqueios de inacessibilidade/retroatividade continuam resolvidos. Verificação própria 78/78 Vitest, Playwright focal 4/4, diff-check e Git limpo.
- Revisão FIBA/boxscore independente: Aquinas, 01a12e14-2aad-7453-82e8-84f02191c321, APPROVE_WITH_NON_BLOCKING_NOTES incremental em ff77e5a, REVIEWED_AT=2026-10-12T00:19:30-03:00. Bloqueadores anteriores revogados permanecem resolvidos, caminho P1 corrigido, nenhum novo P0–P3. Verificação própria Vitest 34/34, Playwright focal 5/5, diff-check e Git limpo; evidência anterior de 101 testes e quatro PDFs permanece aplicável a importadores/fixtures sem alteração.
- Actions do código ff77e5a: CI https://github.com/renato-lucindo/base-do-basquete/actions/runs/38199134935 SUCCESS (gate/database/accessibility/remote_history_upgrade); Preview https://github.com/renato-lucindo/base-do-basquete/actions/runs/38199134962 SUCCESS (upload, smoke contextual, segurança/privacidade, acessibilidade pública/reflow); CodeQL https://github.com/renato-lucindo/base-do-basquete/actions/runs/38199134981 SUCCESS. Stage 4 Validation https://github.com/renato-lucindo/base-do-basquete/actions/runs/38199131074 COMPLETED/SUCCESS: pgTAP principal, upgrade histórico, QA (build/testes/acessibilidade) e integração (sem conflitos com main), todos SUCCESS. Nenhuma alteração funcional posterior a essas evidências ou aos pareceres.
- pgTAP verificado nos logs do CI ff77e5a: 49 arquivos/1.408 asserções PASS no banco descartável do zero; upgrade histórico focal 9 arquivos/345 asserções PASS. Nenhuma migration nova, aplicação remota, repair ou DML no Supabase compartilhado; sem main/merge/produção. Evidência valida a baseline reconstruída nos workflows, não uma cópia fiel do ambiente compartilhado.
- REVIEW_PACKET: https://github.com/renato-lucindo/base-do-basquete/pull/72#issuecomment-6117118746 (delta complementar corrige o packet inicial #6117016801). RISK_LEVEL=CRITICO; REQUIRED_REVIEWERS FIBA/boxscore e estatística válidos no ff77e5a; QA/acessibilidade AUTOMATED pelos focais/gate/Actions; database-security/performance WAIVED por ausência de alteração SQL/RLS/Auth/RPC, consulta, Worker ou cache. REVIEW_APPROVER=project-maintainer. Código funcional estável desde os pareceres; delta deste fechamento exclusivamente documental, validado por git diff --check e inspeção de arquivos alterados, sem repetir build/suíte/segredos.
- Riscos residuais não bloqueantes: rascunho local, debounce/histórico curto existentes, cronologia Q4/OT deliberadamente agrupada, recuperação editável de rascunho histórico incompatível indisponível, validação autoritativa a integrar na Etapa 8 conforme plano atualizado. Nenhuma aprovação de merge/release da PR inteira é atribuída.

WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE7-FAST-FOULS; HEAD_FUNCIONAL=ff77e5a7469f5501a505df66e2cb42113862f521; STATUS=RELEASED (Etapa 7 concluída, pareceres críticos válidos e quatro workflows SUCCESS; commit deste fechamento exclusivamente documental).

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer.
ARQUIVO_OU_SERVICO: docs/plan/sumula-manual-v2/08-revisao-final-confirmacao.md, app/modules/scoresheet/setup-wizard.tsx, serviços de confirmação transacional da súmula e PR #72.
ACAO: abrir unidade da Etapa 8 com write lock próprio; implementar revisão final e confirmação transacional do wizard, validando autoritativamente pontuação por OT, empates entre períodos, faltas agrupadas Q4/OT, GD e LL coletivos conforme plano. Reutilizar evidências da Etapa 7 onde não houver delta e renovar testes/pareceres dos domínios alterados. Manter PR draft, sem aplicar migrations no Supabase compartilhado, merge em main ou produção.
CRITERIO_DE_CONCLUSAO: confirmação inicial ponta a ponta com validações servidor/transação, idempotência/concorrência, rascunho limpo somente após gravação comprovada, testes e pareceres obrigatórios verdes no SHA da Etapa 8. Essa etapa não foi iniciada neste fechamento.

## 31. Unidade ativa — Etapa 8: confirmação da súmula manual v2 (12/10/2026)

WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE8-CONFIRM; BRANCH=codex/manual-stage4-v3-review (upstream origin/codex/manual-scoresheet-v2); HEAD_COMMIT=cbd50d4f98ce18b3860679a155d22e8f264f3152; STATUS=ACTIVE.

- Objetivo: conectar a revisão final do wizard à RPC transacional v2, com revisão completa, verificação do domínio no servidor, idempotência, erros acessíveis e preservação do rascunho até a confirmação real.
- Escopo: wizard, rota administrativa, regras SQL em migration nova e testes proporcionais. Critério de aceite: teste de gravação/retry, OT/GD/Q4, sem perda do rascunho em falhas.
- Escopo negativo: migrations no Supabase compartilhado, merge na main ou publicação em produção; preservar outras unidades e worktrees.
- REVIEW_PACKET inicial: RISK_LEVEL=CRITICO; database-security-reviewer e statistics-domain-reviewer REQUIRED; accessibility-ui-reviewer e qa-reviewer conforme risco e evidência; boxscore-domain-reviewer somente se o contrato FIBA for alterado.

PROXIMO_PASSO_EXATO: integrar `app/modules/scoresheet/setup-wizard.tsx` com `app/routes/admin.competitions.$competitionId.scoresheets.new.tsx` e `public.admin_create_manual_scoresheet_v2`, testar validações de pontuação/OT/GD/faltas agrupadas em SQL descartável, publicar o commit e colher revisões.

### Checkpoint intermediário da Etapa 8 — 12/10/2026

- No worktree `manual-stage4-v3-review`, a revisão final (passo 4), a action autenticada AAL2/CSRF e a chamada `admin_create_manual_scoresheet_v2` foram conectadas. O servidor reconstrói e valida o payload de criação, os períodos Q1–Q4/OT, GD, faltas legadas e rápidas, elenco, comissão e oficiais. O draft só é removido após resposta de confirmação; falhas preservam a chave de idempotência para retry.
- A fixture de teste da action foi corrigida para camisa `7` (em vez de `07`). Vitest focal: 4 arquivos, 23 testes PASS. `npm run typecheck`: PASS após correção de acesso opcional às chamadas do mock da RPC. `npm run check`: PASS, 64 arquivos/546 testes, format, lint (avisos preexistentes), typecheck, runbooks, agentes, build e varredura de segredos. `git diff --check`: PASS, com aviso de conversão CRLF do próprio HANDOFF.
- Novo E2E do passo 4 cobre revisão, erro da gravação, preservação do rascunho, retry com a mesma chave e limpeza após sucesso simulado. A execução focal de Playwright iniciou na sessão 85151; a consulta ao resultado foi recusada pela revisão automática da plataforma mesmo após autorização explícita do usuário. Não alegar resultado E2E verde até obter evidência verificável. `test-results/.last-run.json` gerado localmente diz `passed`, mas não associa resultado verificável ao cenário focal. O arquivo de resultado ignorado pelo Git recebeu apenas newline para permitir `format:check`.
- Ainda pendentes: pgTAP/RLS em PostgreSQL descartável no GitHub Actions, E2E verificável, pareceres independentes de banco/segurança e estatística, avaliação acessibilidade/QA e atualização do REVIEW_PACKET/CI da PR #72. Sem migrations no Supabase compartilhado, sem merge na main e sem produção. Etapas 9 e 10 não iniciadas.
- WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE8-CONFIRM; STATUS=ACTIVE; branch `codex/manual-stage4-v3-review`, upstream `origin/codex/manual-scoresheet-v2`; BASE_COMMIT=cbd50d4f98ce18b3860679a155d22e8f264f3152. A alteração será versionada como checkpoint WIP até os gates/reviews.
- PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=PR #72/Actions, `e2e/manual-scoresheet-setup.spec.ts`, `app/modules/scoresheet/setup-confirmation.ts` e `HANDOFF.md`; ACAO=publicar o checkpoint WIP na branch da PR sem fazer merge, verificar CI/pgTAP no SHA publicado, obter resultado E2E autorizável e pareceres críticos independentes, corrigir bloqueios e então encerrar a Etapa 8; CRITERIO_DE_CONCLUSAO=gate E2E e SQL verde no SHA funcional, ausência de P0/P1, dois pareceres críticos válidos, HANDOFF e REVIEW_PACKET atualizados para o mesmo commit, etapa 8 liberada para iniciar a 9.

### Retomada e correções de revisão — 12/10/2026

- HEAD local/remoto confirmado `82ec7e87a24e42411da8f3858277bb357d480907`; PR #72 OPEN/DRAFT, worktree `manual-stage4-v3-review`, upstream `origin/codex/manual-scoresheet-v2`. Oito arquivos de implementação/teste/workflows locais preservados; origem: correções iniciadas pelo project-maintainer após revisão do WIP. WRITE_LOCK OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE8-CONFIRM; STATUS=ACTIVE.
- Checks do WIP verificados: Stage 4 Validation/pgTAP e QA `38261522145`, CI `38261530585`, Preview `38261530608` e CodeQL `38261530613` SUCCESS; Supabase Preview SKIPPED. Esses runs não validam as correções locais posteriores.
- Pareceres do WIP: estatística Sartre e QA Aquinas BLOCK_RELEASE por P1 SQL rejeitar pontos OT após GD no grupo Q4/OT; acessibilidade Chandrasekhar BLOCK_RELEASE por erro residual após sucesso e associação do motivo emergencial. Banco Dewey sem parecer válido (execução recusada). Bloqueios só podem ser encerrados com novas revisões independentes no código corrigido.
- Correções locais: migration aditiva `20261012113000_manual_scoresheet_v2_ot_disqualification.sql` restringe o bloqueio de pontos posteriores a GD Q1–Q3; preserva função privada SECURITY DEFINER, search_path vazio e EXECUTE restrito. Três regressões pgTAP cobrem gravação OT após GD Q4, período persistido e rejeição após GD Q3. Workflows descartáveis passam a aplicar o patch também na reconstrução histórica. Nenhuma migration histórica alterada.
- UI limpa os erros após sucesso, associa erro do motivo emergencial e contém a rolagem da tabela de revisão. Formatação acidental do Prettier normalizada com Biome. Vitest focal inicial 6/6 PASS; Playwright novo cenário de erro/reflow em 320px/zoom 200% PASS após preencher técnicos obrigatórios na fixture; execução integral focal em andamento, sem alegar resultado antes de conclusão.
- Pendentes: gate consolidado do delta, pgTAP no Actions, commit/push, REVIEW_PACKET e quatro pareceres independentes renovados. Etapas 9 e 10 ainda não iniciadas.
- PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=PR #72/Actions e testes de confirmação; ACAO=concluir E2E/gate, publicar correções na branch da PR, verificar pgTAP descartável e renovar pareceres de banco, estatística, acessibilidade e QA; CRITERIO_DE_CONCLUSAO=checks verdes no novo SHA e todos os bloqueios levantados por parecer válido, antes de abrir Etapa 9.

### Gate local das correções — 12/10/2026

- `npm run check` PASS: 64 arquivos/547 testes Vitest, formatação, lint sem erros bloqueantes (avisos preexistentes), typecheck, runbooks/agentes, build client/SSR e scan 751 arquivos. Gate iniciou com falhas de newline no resultado efêmero do Playwright e semântica/tabIndex da região; ambas corrigidas. Região agora usa section nomeada com foco visível e exceção focal de lint justificada para rolagem por teclado, seguindo ScrollableTable existente.
- Playwright focal integral: 22/22 PASS; após ajuste semântico final da região, os dois cenários afetados de confirmação/retry e motivo emergencial/320px/zoom 200% novamente PASS. Axe sem violações nesses cenários. A fixture E2E simula a action; não representa gravação num Supabase remoto. Persistência/idempotência transacional devem ser demonstradas pelo pgTAP no Actions.
- Vitest focal de action/conversão: 10/10 PASS, incluindo Q4 empatado sem conclusão explícita recusado antes da RPC, e aceito após confirmação. A confirmação é a declaração do operador validada pela action autenticada; o banco valida de forma independente empates acumulados e placar final. Não é possível inferir conclusão temporal real a partir de uma transcrição pós-jogo; a confirmação não substitui a validação dos pontos.
- Manifest de migrations pendentes atualizado com o patch de OT, além de ambos os workflows de reconstrução histórica, preservando o histórico remoto registrado. Mudança semântica única no writer: `and dq_period < 4`; assinatura, segurança e demais validações inalteradas. Sem mudança no contrato de tipos SQL ou importadores.
- SKILL_RESULT: managing-base-work-unit=PASS (reconciliação); validating-basketball-statistics=CHANGES_REQUIRED e reviewing-supabase-changes=CHANGES_REQUIRED até pgTAP/revisões; validating-accessibility-ui=PASS nos fluxos focais (sem alegar WCAG integral); running-release-gate=BLOCKED por pareceres/Actions pendentes. Nenhum bloqueio anterior foi dispensado.
- Próximo passo exato: publicar este checkpoint corretivo na branch `origin/codex/manual-scoresheet-v2`, publicar REVIEW_PACKET vinculado ao SHA e verificar CI/Stage 4 Validation/pgTAP/Preview/CodeQL; obter novos pareceres de banco, estatística, acessibilidade e QA. Somente com todos válidos e verdes encerrar Etapa 8 e abrir Etapa 9. WRITE_LOCK permanece ACTIVE; sem merge, Supabase compartilhado ou produção.

### Revisões e Actions do SHA 61f3536 — 12/10/2026

- Commit `61f35361c106e44871e51ec9e953b2e1a748516f` publicado em `origin/codex/manual-scoresheet-v2`; worktree limpo após push. REVIEW_PACKET: https://github.com/renato-lucindo/base-do-basquete/pull/72#issuecomment-6126961013.
- Todos os workflows SUCCESS nesse SHA: CI `38267616652`, Stage4 `38267612950`, Preview `38267616631`, CodeQL `38267616630`. Stage4: 49 arquivos/1.411 pgTAP; reconstrução histórica 9 arquivos/348 pgTAP; QA 31 E2E; integração sem conflito. Supabase Preview SKIPPED esperado. Somente PostgreSQL descartável, sem operação no compartilhado.
- Acessibilidade Chandrasekhar `01a13078-13a8-7c22-b9b4-567edcd0fe85`: APPROVE_WITH_NON_BLOCKING_NOTES no 61f3536; P1 erro residual/P2 associação de erro formalmente revogados. Ressalvas: evidência local documental, zoom CSS e sem asserção focal de rolagem por teclado; não bloqueantes.
- Estatística Sartre `01a13077-fcfb-7fa3-a14d-61b2e1c4aa8f`: P1 GD Q4/OT formalmente revogado; REQUEST_CHANGES P2 em 61f3536 porque writer ainda permite foul.periodNumber=5 ou superior, contrariando o grupo Q4/OT. Exige limite1–4 e regressão que recuse período5 mesmo num jogo com OT1.
- As revisões read-only de banco/QA desse SHA foram interrompidas/encerradas sem parecer final para permitir a correção; não atribuir aprovação. Ambas devem ser retomadas no SHA corrigido. Acessibilidade não será reaberta para delta exclusivamente SQL/teste, nos termos de validade por domínio do contrato.
- WRITE_LOCK project-maintainer ACTIVE. Próximo passo exato: limitar período das faltas no writer da migration ainda não aplicada no compartilhado, adicionar pgTAP e publicar novo commit com gate apropriado; renovar banco/estatística/QA no novo SHA e registrar todos resultados. Etapa8 permanece aberta, Etapas9–10 não iniciadas.

### Correção focal P2 — grupos de faltas Q4/OT

- O writer privado da migration `20261012113000` (ainda não aplicada no compartilhado) agora aceita períodos de falta somente1–4; pontos continuam Q1–Q4/OT1–OT8. Nova assertiva pgTAP exige BD219 para falta no período5 mesmo com OT1 válido. Suíte passa de40 para41 assertivas. Nenhuma alteração em schema/assinatura/importadores/UI.
- `npm run check` novamente PASS após delta SQL (547 Vitest e demais gates; scan751). `git diff --check` PASS. Browser não repetido por ausência de delta UI; evidências22/22+2/2 locais e31/31 Actions61f3536 preservadas. pgTAP41 ainda pendente no novo SHA a publicar; nenhuma alegação antecipada.
- REVIEW_DECISIONS: banco/estatística/QA REQUIRED renovação no novo SHA; acessibilidade APPROVE_WITH_NON_BLOCKING_NOTES61f3536 continua aplicável ao artefato UI inalterado, sem reabrir o domínio (contrato de validade). WRITE_LOCK ACTIVE; PR DRAFT e sem shared migrations/merge/produção.

## 32. Encerramento técnico — Etapa 8 / confirmação inicial (12/10/2026)

- BASE_COMMIT `cbd50d4f98ce18b3860679a155d22e8f264f3152`; HEAD_FUNCIONAL `eddc2cb17bbd6c8912b05370e0d01221bce332e2`. Commits corretivos publicados: `61f3536` (GD Q4/OT e feedback/erro acessível) e `eddc2cb` (períodos de faltas SQL1–4). PR #72 verificada OPEN/DRAFT nesse HEAD. Este fechamento altera somente HANDOFF, sem mudança do artefato revisado.
- Fluxo inicial completo: revisão final, confirmação action AAL2/origem/CSRF, reconstrução autoritativa do payload, RPC transacional e retry com mesma chave. Falhas preservam o draft; sucesso limpa draft/erros e restaura foco. OT requer confirmação explícita de conclusão do período anterior e empate calculado na action; banco recalcula empates acumulados e placar final. Pontos Q1–Q4/OT1–OT8, faltas1–4 com grupo Q4/OT, GD nesse grupo permite pontos OT; GD Q1–Q3 bloqueia pontos posteriores.
- Gate local final PASS: 64 arquivos/547 Vitest, formatação, lint sem erros bloqueantes (avisos preexistentes), typecheck, runbooks/agentes, build client/SSR e secrets751. Playwright wizard22/22+2/2 focais após ajuste final UI; action/conversão10/10. Browser não repetido localmente após delta exclusivamente SQL; Actions final cobre suite31/31. `git diff --check` PASS. Revisão de banco executou adicionalmente12 testes focais PASS.
- Actions finais em eddc2cb, todos COMPLETED/SUCCESS: CI https://github.com/renato-lucindo/base-do-basquete/actions/runs/38269440011 (gate, database, accessibility, remote_history_upgrade); Stage4 https://github.com/renato-lucindo/base-do-basquete/actions/runs/38269432057 (49 arquivos/1.412 pgTAP, histórico9 arquivos/349 pgTAP, QA31E2E, Integration sem conflito); Preview https://github.com/renato-lucindo/base-do-basquete/actions/runs/38269440036; CodeQL https://github.com/renato-lucindo/base-do-basquete/actions/runs/38269440017. Supabase Preview SKIPPED esperado. Contagens confirmadas nos resumos filtrados de logs finais. A reconstrução é schema-only e não cópia integral do compartilhado.
- Banco/segurança Dewey `01a13077-e53c-76c1-bec6-85f92ca851ae`: APPROVE_WITH_NON_BLOCKING_NOTES, COMMIT_REVISADO=eddc2cb, REVIEWED_AT=2026-10-12T12:22:05-03:00. AAL2/CSRF, grants/RLS, writer privado/search_path, atomicidade, rollback e idempotência inspecionados; nenhum bloqueante. Nota: não houve corrida simultânea focal da RPCv2 completa (retry sequencial e lock verificados).
- Estatística Sartre `01a13077-fcfb-7fa3-a14d-61b2e1c4aa8f`: APPROVE_WITH_NON_BLOCKING_NOTES, COMMIT_REVISADO=eddc2cb, REVIEWED_AT=2026-10-12T12:24:00-03:00. REQUEST_CHANGES expressamente revogado: P1GD Q4/OT e P2falta5 corrigidos; pgTAP1.412 e upgrade verificados. Nenhum bloqueio estatístico aberto.
- QA Aquinas `01a13078-2ba9-7450-bfbc-3c617d508a50`: APPROVE_WITH_NON_BLOCKING_NOTES, COMMIT_REVISADO=eddc2cb, REVIEWED_AT=2026-10-12T12:21:46-03:00. P1GD revogado, P2 inspecionado corrigido; composição E2E simulado+action tests+pgTAP real aceita como evidência. Gates/especialistas que estavam pendentes na emissão agora concluídos favoravelmente; sem atribuir ao revisor verificação posterior que coube ao mantenedor.
- Acessibilidade Chandrasekhar `01a13078-13a8-7c22-b9b4-567edcd0fe85`: APPROVE_WITH_NON_BLOCKING_NOTES, COMMIT_REVISADO=61f3536, REVIEWED_AT=2026-10-12 America/Sao_Paulo; P1erro residual/P2associação do motivo formalmente revogados. Parecer válido por domínio em eddc2cb, cujo delta é somente SQL/teste/HANDOFF. Ressalvas: zoomCSS, sem asserção focal de scroll por teclado e resultados locais conferidos documentalmente, sem alegar conformidade WCAG integral.
- REVIEW_PACKET inicial https://github.com/renato-lucindo/base-do-basquete/pull/72#issuecomment-6126961013; incremental final https://github.com/renato-lucindo/base-do-basquete/pull/72#issuecomment-6127217431. RISK_LEVEL=CRITICO; quatro revisores obrigatórios atendidos. Boxscore/performance WAIVED somente por ausência de alteração em importação/contratos/cache/consultas públicas. REVIEW_APPROVER=project-maintainer. Nenhuma dispensa de bloqueio anterior.
- SKILL_RESULT: managing-base-work-unit=PASS; reviewing-supabase-changes=PASS; validating-basketball-statistics=PASS; validating-accessibility-ui=PASS no domínio focal; running-release-gate=READY para concluir Etapa8, não para merge/release da PR inteira. Banco descartável somente; nenhuma migration aplicada no Supabase compartilhado, merge main ou produção.
- WRITE_LOCK OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE8-CONFIRM; HEAD_FUNCIONAL=eddc2cb; STATUS=RELEASED. Worktree limpo antes deste delta documental, que será commitado e enviado à mesma branch. Não repetir build/suite/scan após registrar estas evidências, pois o artefato não mudou.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer.
ARQUIVO_OU_SERVICO: docs/plan/sumula-manual-v2/09-edicao-sumula-existente.md, app/modules/scoresheet/setup-wizard.tsx, app/routes.ts, nova rota administrativa de súmula salva, public.admin_revise_manual_scoresheet_v2 e PR #72.
ACAO: abrir unidade própria Etapa9 já autorizada, com WRITE_LOCK ativo; carregar snapshot/submissão ativa, disponibilizar edição com equipes imutáveis, diff legível/impacto no placar, motivo e confirmação; enviar baseSubmissionId/hash e revisionKey para conflito otimista/idempotência; preservar draft por jogo/base e consultar histórico imutável. Implementar interface/servidor/testes e renovar os pareceres dos domínios afetados antes da Etapa10. Não aplicar migrations compartilhadas nem fazer merge/produção.
CRITERIO_DE_CONCLUSAO: criar e revisar como fluxos completos, conflito não sobrescreve dados, motivo obrigatório, histórico consultável, gate/tests/Actions verdes no novo artefato e pareceres válidos; Etapas9 e10 ainda não iniciadas neste fechamento.

## 33. Etapa 9 — revisão de súmula salva

- WORK_UNIT: MANUAL-SCORESHEET-V2-STAGE9-REVISION; project-maintainer é o único escritor.
- Base local e remota reconciliada: 98212482e4c316ba0517df70fa9e2d9696f79641; worktree inicialmente limpo; PR #72 OPEN/DRAFT.
- Objetivo/aceite: abrir snapshot ativo, editar os campos permitidos com equipes imutáveis, comparar alterações e placar, exigir motivo e confirmação, enviar baseSubmissionId/hash e revisionKey à RPC existente, preservar rascunho em conflito e consultar histórico imutável.
- Escopo: rota/interface de revisão, conversão de snapshot, contrato tipado da RPC existente, navegação, testes e evidências da etapa. Risco CRITICO: persistência, concorrência e publicação estatística.
- Revisores obrigatórios: banco/segurança, estatística, acessibilidade e QA; pareceres da Etapa 8 não aprovam mudanças desta unidade.
- Escopo negativo: sem migrations no Supabase compartilhado, merge, produção, parser PDF ou fluxo de conflito com boxscore.
- Próximo passo exato: implementar rota de súmula salva e modo de revisão do wizard; validar round-trip, CAS/idempotência, diff, histórico, teclado e preservação do draft, depois gates/Actions e pareceres independentes no SHA estabilizado.

### Checkpoint de implementação da Etapa 9 — 12/10/2026

- Rota administrativa de súmula salva com autenticação AAL2, origem/CSRF, histórico de versões somente leitura e editor da submissão ativa quando os seis domínios de autoridade permanecem na súmula manual. Gravação por `admin_revise_manual_scoresheet_v2` existente, enviando `baseSubmissionId`/hash, `revisionKey` estável e motivo. Erros de concorrência preservam rascunho; confirmação obrigatória, diff de campos, impacto no placar e identidade imutável.
- O contexto de revisão recupera também inscrição e atleta presentes no snapshot mesmo após ficarem inativos, preservando a possibilidade de consultar e corrigir partidas históricas; atletas inativos que não constam do snapshot permanecem fora das opções. O loader também exige `games.source=manual` para habilitar edição.
- Vitest focal: 3 arquivos / 15 testes PASS (round-trip, OT, autorização, conflito otimista, retry, histórico e elenco histórico); Playwright focal: 4/4 PASS (teclado, diff, motivo, draft, conflito, consulta imutável, viewport 390px e zoom 200%, axe sem violações nos cenários focais).
- Gate local `npm run check` PASS: 67 arquivos/562 testes Vitest, formatação, lint com avisos preexistentes sem erros bloqueantes, typecheck, runbooks, contrato de agentes, build client/SSR e scan de segredos em 760 arquivos. Antes do gate, normalizado newline de `test-results/.last-run.json` gerado pelo Playwright; a primeira tentativa do gate havia parado unicamente nesse arquivo efêmero. `git diff --check` PASS (aviso de CRLF em HANDOFF); não foram executadas migrations em ambiente compartilhado.
- SKILL_RESULT: managing-base-work-unit=PASS; validating-basketball-statistics=PASS nos testes de conversão/pontuação/OT focais, revisão independente pendente; validating-accessibility-ui=PASS nos fluxos browser focais, revisão independente pendente; reviewing-supabase-changes=PENDING avaliação especializada (sem delta SQL); running-release-gate=PENDING Actions e pareceres do novo SHA. WRITE_LOCK project-maintainer permanece ACTIVE, PR #72 OPEN/DRAFT.
- PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=branch origin/codex/manual-scoresheet-v2 e PR #72/Actions; ACAO=commit/push do checkpoint Etapa9, confirmar CI, Stage4 Validation (pgTAP descartável), Preview e CodeQL no novo SHA, obter e registrar revisão independente de banco/segurança, estatística, acessibilidade e QA; CRITERIO_DE_CONCLUSAO=checks verdes e pareceres válidos sem bloqueantes antes de fechar a Etapa9 e abrir a Etapa10. Não fazer merge, produção ou Supabase compartilhado.

### Correções posteriores à revisão independente da Etapa 9 — 12/10/2026

- No commit `c6fed911f057ff04ffdc0d93e42d189f10c75a0f`, todos os Actions anteriores estavam SUCCESS: Stage 4 Validation `38276881573` (incluindo pgTAP em PostgreSQL descartável), CI `38276890266`, Preview `38276890296`, CodeQL `38276890306`; Supabase Preview SKIPPED conforme desenho. Essas evidências não aprovam o delta subsequente.
- Parecer independente de acessibilidade Nietzsche (`01a130ec-c06a-73c2-bcc6-b32c4145`) no c6fed91: REQUEST_CHANGES por três P2: falta de associação do erro ao checkbox de confirmação, falta de foco no título ao trocar versão e faltas históricas exibidas por IDs. Foram corrigidos com `aria-invalid`/`aria-describedby` e mensagem associada; foco no h1 na edição e histórico com remount por submissão; histórico de faltas legível com nome, camisa e equipe, preservando fallback de IDs. E2E ampliado para esses três casos.
- Ajustes de E2E: landmark nav na fixture histórica para satisfazer axe; asserção da remoção do rascunho aguarda o efeito assíncrono após gravação. Teste Playwright final `e2e/manual-scoresheet-revision.spec.ts` 4/4 PASS (foco, erros, revisão, histórico, axe, largura 390px e tamanho de texto 200%). Vitest focal de conversão/contexto 2 arquivos/5 testes PASS.
- Gate consolidado depois das alterações funcionais PASS: `npm run check` com formato, lint sem erros bloqueantes (319 avisos preexistentes), typecheck, 67 arquivos/562 testes Vitest, runbooks, contrato de agentes, client/SSR build e scan de 760 arquivos. Primeira tentativa bloqueou apenas por newline do `test-results/.last-run.json` efêmero gerado por Playwright, normalizado com Biome. Alteração final somente na fixture `nav` foi seguida de Playwright 4/4 PASS, Biome format/lint focal e `git diff --check` PASS; não houve nova migration.
- Correção do registro anterior: banco/segurança Tesla (`01a130ec-9edf-7263-ae71-6e42337ca0b5`), estatística Faraday (`01a130ec-aee6-77b3-83ff-a1dcafea2b4a`) e QA Sagan (`01a130ec-d098-7ad3-9c5f-d7d11cadbfd1`) emitiram REQUEST_CHANGES no c6fed91: atleta histórico inativo bloqueava revisão (P1), edição arquivada não era bloqueada na RPC (banco/QA) e faltava evidência de concorrência entre conexões (QA). Acessibilidade e demais pareceres precisam ser renovados sobre as correções; gates verdes anteriores não revogam esses achados.
- WRITE_LOCK OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE9-REVISION; STATUS=ACTIVE. PR #72 deve permanecer OPEN/DRAFT. Sem alterações no Supabase compartilhado, merge ou deploy de produção.
- PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=branch `origin/codex/manual-scoresheet-v2`, PR #72/Actions e pareceres especializados; ACAO=commit/push do delta de acessibilidade e HANDOFF, verificar CI/pgTAP/Preview/CodeQL no novo SHA, obter parecer renovado de acessibilidade e os pareceres de banco, estatística e QA, corrigindo eventuais bloqueios; CRITERIO_DE_CONCLUSAO=quatro pareceres válidos sem P0/P1/P2 bloqueantes e todos os gates verdes no SHA final para fechar Etapa 9. Etapa 10 ainda não iniciada.


### Correções de revisão estatística/domínio — 12/10/2026

- Migration aditiva `20261012174500_manual_scoresheet_v2_revision_guards.sql` criada para corrigir os bloqueios encontrados na revisão da PR #72.
- Revisões agora dependem das autoridades de domínio da RPC, sem usar `games.source` como autorização suficiente.
- Atletas inativos podem permanecer em uma revisão somente quando já existiam no snapshot imutável da submissão ativa anterior da súmula, para a mesma equipe/lado. Novos atletas inativos continuam bloqueados.
- RPC de revisão bloqueia competição arquivada com verificação transacional.
- Foram adicionadas regressões pgTAP e os workflows descartáveis CI/Stage4 passaram a incluir a nova migration no overlay local de validação.
- `npm run check` PASS: formato, lint, typecheck, 67 arquivos/562 testes Vitest, runbooks, agentes, build e scan de segredos.
- Playwright `e2e/manual-scoresheet-revision.spec.ts` PASS: 4/4.
- Não houve aplicação de migration no Supabase compartilhado, merge na main ou deploy.
- PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=PR #72/Actions; ACAO=commit/push do delta, validar pgTAP descartável no Actions e renovar pareceres independentes; CRITERIO_DE_CONCLUSAO=gates verdes e revisões válidas antes de fechar Etapa 9.

### Reconciliação do push e renovação dos gates — 12/10/2026

- HEAD funcional `9073c858fe220a2bea00fb0058e495f07688751f`. O push anterior criou `origin/codex/manual-stage4-v3-review` e não atualizou a PR #72, cujo head remoto permaneceu c6fed91 em `codex/manual-scoresheet-v2`. A branch adicional será preservada; o envio correto será um fast-forward explícito para a branch da PR.
- Gate local e Playwright 4/4 já aprovados para o artefato 9073c85. Não repetir suíte/build para este ajuste exclusivamente documental. SQL ainda depende do pgTAP descartável; pareceres prévios REQUEST_CHANGES não estão encerrados.
- WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE9-REVISION; WRITE_LOCK OWNER=project-maintainer; STATUS=ACTIVE. RISK_LEVEL=CRITICO. REQUIRED_REVIEWERS=banco/segurança, estatística, acessibilidade e QA. Sem dispensa de achados.
- PROXIMO_PASSO_EXATO: enviar HEAD para `origin/codex/manual-scoresheet-v2`, publicar REVIEW_PACKET na PR #72, verificar Actions/pgTAP/preview no novo SHA e renovar quatro pareceres independentes. Validar concorrência real entre conexões se a evidência existente não cobrir; corrigir falhas até gates e pareceres verdes. Escopo negativo: sem merge, migration compartilhada ou produção.

### Evidência complementar de concorrência — 12/10/2026

- Adicionado `scripts/test-manual-scoresheet-revision-concurrency.mjs`, restrito a CI=true e ao container PostgreSQL descartável do projeto. Duas conexões aguardam uma barreira de lock real antes de executar a RPC. Cobre retry idêntico (uma versão/auditoria) e CAS divergente (um vencedor/conflito, seis autoridades consistentes, histórico e notas preservados). Incluído em CI e Stage4; execução remota ainda pendente.
- Duas regressões Vitest na rota cobrem origem legada distinta com seis autoridades válidas, autoridade divergente e edição arquivada/erro BR032. `npm run check` PASS após o delta: 67 arquivos/564 testes, build/typecheck/formato/lint e scan762. Evidência Playwright 4/4 preservada: nenhum componente UI mudou neste delta.
- PR #72 já recebeu 6a8958b em `codex/manual-scoresheet-v2`; novas evidências de concorrência serão publicadas em commit próprio, com REVIEW_PACKET e renovação dos quatro pareceres no SHA resultante.

## 34. Etapa 9 — evidências finais e bloqueio operacional (12/10/2026)

- ARTEFATO_FUNCIONAL: `80a33355d98dc351214d825557323fa29ebf957b`; BASE_ETAPA9: `98212482e4c316ba0517df70fa9e2d9696f79641`. Todos os commits corretivos estão publicados na branch correta `origin/codex/manual-scoresheet-v2` da PR #72 OPEN/DRAFT. A branch remota adicional `codex/manual-stage4-v3-review`, criada no push anterior por engano, foi preservada.
- REVIEW_PACKET final: https://github.com/renato-lucindo/base-do-basquete/pull/72#issuecomment-6130424575. Pareceres integrais e limites de evidência em `docs/execution/manual-scoresheet-stage9-final-review.md`. RISK_LEVEL=CRITICO; quatro revisores independentes efetivamente executados, sem dispensa de bloqueantes. Primeiras tentativas falharam por capacidade do serviço; pareceres posteriores abaixo são resultados reais no artefato funcional fixo.
- Banco Harvey `01a1316d-b10c-7db2-b4f9-377dab45dec0`: APPROVE_WITH_NON_BLOCKING_NOTES; 2026-10-12T18:49:38Z; revoga explicitamente P1 inativo e P2 arquivado de Tesla. Estatística Schrodinger `01a1316d-b262-7461-b32d-76b8a453f4c7`: APPROVE_WITH_NON_BLOCKING_NOTES; 2026-10-12T15:49:54-03:00; revoga P1 inativo de Faraday. Acessibilidade Hegel `01a1316e-e843-77c0-aee5-53dc3f050eb0`: APPROVE_WITH_NON_BLOCKING_NOTES; 2026-10-12T15:49:05-03:00; revoga os três P2 de Nietzsche, com Playwright próprio 4/4 PASS.
- QA Archimedes `01a1316e-e9d2-7681-8088-18a92e500f46`: BLOCK_RELEASE; 2026-10-12T18:49:34Z. Revoga os antigos achados funcionais de Sagan (inativo/arquivado/concorrência), sem novo defeito funcional bloqueante. Renovação focal em 2026-10-12T18:51:43Z confirmou os três pareceres especializados e retirou a pendência de pareceres; BLOCK_RELEASE permanece exclusivamente operacional pelo Stage4 recusado por cobrança. Relatório renovado preservado integralmente junto aos demais pareceres.
- GitHub Actions no artefato: CI `38292700529` SUCCESS (gate, banco do zero/upgrades, pgTAP, concorrência real, acessibilidade/E2E e reconstrução histórica); Preview `38292700402` SUCCESS (upload preview, smokes e acessibilidade pública); CodeQL `38292700390` SUCCESS. Stage4 `38292694151`: pgTAP/concorrência e upgrade histórico SUCCESS, QA FAILURE antes de iniciar e integração SKIPPED. Totais confirmados pelos revisores: 49 arquivos/1.418 pgTAP; reconstrução histórica 9 arquivos/355 pgTAP; revisões 66 assertivas.
- Reexecução somente dos jobs falhos feita uma vez (attempt2): QA `114958949530` novamente recusado antes de iniciar por aviso GitHub de pagamento/limite de gastos. Annotation: recent account payments have failed or spending limit needs to be increased. Não é regressão de código; não foi alterada cobrança, orçamento, runner, workflow ou gate para contornar a restrição. Não alegar Stage4 aprovado.
- Integração local read-only: fetch de main `27d917a1ce4a404ced091fd3ca660113c215ca92` e `git merge-tree --write-tree origin/main HEAD` PASS, árvore `f8e111c1dea734a7ae3f9e555f762238d3fa4269`. Não houve merge no worktree nem em main. Esse resultado não substitui job remoto obrigatório.
- Gate local do delta funcional: npm run check PASS, 67 arquivos/564 Vitest, typecheck/build/formato/lint/scan762. Playwright focal 4/4 PASS, também reexecutado pelo revisor acessível; banco 17 Vitest focais PASS e estatística 116 testes focais PASS. Não repetir build/suite após este registro documental, pois o artefato funcional não mudou.
- Compartilhado: consulta read-only pelo revisor de banco confirmou última migration aplicada `20261005140504`; migration nova e demais migrations da feature seguem pendentes. Sem aplicação de migrations, merge main ou produção. Preview não homologa escrita autenticada contra o schema compartilhado; persistência/concorrência demonstradas em PostgreSQL descartável. Ressalvas UI: fixture isolada, ampliação textual em vez de zoom nativo, sem auditoria WCAG integral.
- SKILL_RESULT: managing-base-work-unit=PASS; reviewing-supabase-changes=PASS no domínio; validating-basketball-statistics=PASS; validating-accessibility-ui=PASS focal; running-release-gate=BLOCKED / NOT_READY por QA Stage4 recusado. Etapa9 segue aberta; Etapa10 não iniciada.
- WRITE_LOCK OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE9-REVISION; STATUS=RELEASED para entrega consistente desta sessão. Retomada deve reativar lock nesta mesma unidade. Estado funcional e serviços consistentes; somente este registro e relatório de pareceres serão commitados/push como delta documental.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: responsável da conta GitHub para cobrança; depois project-maintainer.
ARQUIVO_OU_SERVICO: GitHub Billing & plans; Actions Stage4 run38292694151; PR #72; HANDOFF.md.
ACAO: regularizar pagamento/limite de gastos da conta sem alterar os gates; após capacidade restabelecida, reexecutar somente QA/Integration falhos no artefato documentado, verificar SUCCESS, solicitar renovação focal do QA e registrar resultados. Se HEAD mudar somente por este relatório/HANDOFF, reutilizar pareceres por domínio e evidências do artefato funcional conforme contrato, explicitando o SHA documental.
CRITERIO_DE_CONCLUSAO: Stage4 completo verde, quatro pareceres válidos sem BLOCK_RELEASE/REQUEST_CHANGES e ausência de novos achados; então fechar Etapa9 e abrir Etapa10 para gate final da PR. Manter escopo negativo: sem merge, migrations compartilhadas ou produção. Nenhuma autorização adicional é necessária para comandos técnicos já cobertos; a pendência atual é operacional/financeira externa.

### Retomada — QA executado localmente por instrução do responsável (12/10/2026)

- Responsável instruiu: “quero realizar manualmente então”, após explicação de que o job QA Stage4 repete npm run check e npm run test:e2e já verdes no CI. Executar novamente os comandos localmente, registrar ambiente/logs/artefato e solicitar renovação independente de QA. O resultado remoto histórico continua FAILURE por cobrança; não será marcado artificialmente como SUCCESS nem removido do workflow.
- WRITE_LOCK OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE9-REVISION; HEAD=5e4badff991499ae1824e58654c1e46d9c90b2ca; STATUS=ACTIVE. Artefato funcional80a3335 inalterado; branch/worktree preservados, inicialmente limpos. Escopo desta retomada: execução local dos comandos QA/integração, evidências documentais, revisão focal e publicação na PR72; sem mudanças de código, merge, migration compartilhada ou produção.
- PROXIMO_PASSO_EXATO: executar gate completo e suíte Playwright integral, verificar integração read-only, registrar os resultados reais e obter parecer QA independente sobre a execução local autorizada. Nenhum resultado antecipado.

## 35. Fechamento da Etapa9 — QA local autorizado (12/10/2026)

- O responsável escolheu expressamente a execução manual/local do QA como alternativa ao job Stage4 que não iniciou por cobrança. Esta decisão substitui o local de execução nesta unidade; não reduz comandos, cobertura ou exigência de revisão independente. Workflows e check remoto preservados.
- HEAD executado: `5e4badff991499ae1824e58654c1e46d9c90b2ca`; artefato funcional: `80a33355d98dc351214d825557323fa29ebf957b`. Node24.18.0, npm11.16.0, Windows/PowerShell, Playwright1.63.0/Chromium. `npm ci` EXIT0 e browser instalado/verificado.
- Novo `npm run check` EXIT0: 67 arquivos/564 Vitest PASS, formato, lint sem erros (320 avisos), typecheck, runbooks/agentes, build client/SSR e scan763. Suíte `npm run test:e2e` EXIT0: 35 PASS e1 SKIPPED esperado, 36 cenários/5 workers/1,7min. Cenário condicionado a estatísticas públicas externas já passou no Preview38292700402; nenhum teste removido.
- Integração local read-only novamente PASS contra main27d917a1ce4a404ced091fd3ca660113c215ca92, tree1ab951c886f5173ca12df62e5444b5c4fbf442bc; sem merge. Banco/pgTAP/concorrência/upgrade histórico, Preview e CodeQL verdes no80a3335 preservados por ausência de delta funcional.
- QA Archimedes `01a1316e-e9d2-7681-8088-18a92e500f46` renovado: APPROVE_WITH_NON_BLOCKING_NOTES; COMMIT_REVISADO=5e4badf; ARTEFATO_FUNCIONAL=80a3335; REVIEWED_AT=2026-10-12T19:21:06Z. Revoga expressamente BLOCK_RELEASE operacional após examinar logs e autorização da execução local. Banco/estatística/acessibilidade aprovados no mesmo artefato funcional e válidos por domínio; nenhuma reclassificação fictícia dos checks remotos.
- Relatório, autorização, parecer QA integral e logs sanitizados: `docs/execution/manual-scoresheet-stage9-local-qa.md` e `docs/execution/evidence/manual-scoresheet-stage9-local-qa/`. Novos arquivos são evidências documentais; não alteram código, dependências, testes, migrations ou workflows.
- Nota não bloqueante do QA: npm audit integral detecta seis pacotes high da cadeia DEV (@cloudflare/vite-plugin/miniflare/sharp/source-map-js/undici/wrangler). `npm audit --omit=dev --json` EXIT0, zero vulnerabilidades de produção. Registrar manutenção de tooling separada com atualização de versões/lockfile e gates próprios; risco de DEV não é considerado inexistente. Nenhuma dependência modificada nesta etapa.
- Stage4 remoto continua FAILURE por cobrança e integração remota SKIPPED; não alegar SUCCESS. A pendência operacional do parecer foi encerrada pela execução equivalente local expressamente autorizada e verificada por QA independente. Eventual branch protection do GitHub permanece fora deste aceite; não fazer bypass nem merge.
- SKILL_RESULT: managing-base-work-unit=PASS; running-release-gate=PASS no escopo QA/integração da Etapa9; READINESS=READY para concluir Etapa9. Etapa9 concluída, Etapa10 permanece próxima etapa do plano e não equivale a autorização de merge/rollout. Sem migrations compartilhadas ou produção.
- WRITE_LOCK OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE9-REVISION; STATUS=RELEASED no fechamento desta entrega. Este delta documental será commitado/push para origin/codex/manual-scoresheet-v2 e o resultado publicado na PR72. Sem repetir suítes/build após registrar evidências do artefato inalterado.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer.
ARQUIVO_OU_SERVICO: docs/plan/sumula-manual-v2/10-gate-e-fechamento-pr.md e PR #72.
ACAO: abrir unidade Etapa10, fixar HEAD e preparar packet final da PR; reconciliar pareceres das etapas anteriores por domínio, artefato e ambiente, reutilizando os gates verdes e o QA local autorizado sem repetições desnecessárias. Documentar o check remoto indisponível e plano de rollout/rollback antes de recomendar qualquer integração. Abrir acompanhamento separado dos avisos DEV sem misturar correção de dependências com o fechamento funcional.
CRITERIO_DE_CONCLUSAO: packet final e pareceres obrigatórios aplicáveis ao artefato final, evidências íntegras e ausência de bloqueios funcionais; qualquer operação de merge/main, migrations compartilhadas ou produção continua fora do escopo desta entrega.

## 36. Início da Etapa10 — gate e fechamento da PR #72 (12/10/2026)

- Etapa9 encerrada com QA local autorizado e pareceres válidos no artefato funcional `80a3335`.
- WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE10-GATE; WRITE_LOCK OWNER=project-maintainer; STATUS=ACTIVE.
- HEAD atual: `84f4510` (`docs: record authorized local QA and close stage 9`).
- Ação da Etapa10: preparar packet final da PR #72, reconciliar pareceres por domínio e registrar plano de integração/rollback.
- Restrições mantidas: sem merge na main, sem migrations no Supabase compartilhado e sem produção.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer.
ARQUIVO_OU_SERVICO: PR #72, REVIEW_PACKET e docs/execution da súmula manual.
ACAO: consolidar evidências finais, validar HEAD final, registrar rollout/rollback e concluir o gate da PR.
CRITERIO_DE_CONCLUSAO: packet final aprovado, pareceres válidos no mesmo commit e ausência de bloqueios funcionais.

## 37. Reconciliação efetiva da Etapa 10 (12/10/2026)

- HEAD local inicial `83655344b8ef9093a7019f7e4f20c93df11981f2`, árvore limpa; os commits `3b6560e` e `8365534` ainda não haviam sido enviados. PR #72 OPEN/DRAFT em `84f4510083a4c684f99193be9916530c391d4e15`, base main `27d917a1ce4a404ced091fd3ca660113c215ca92`; fetch read-only confirmado.
- Resumo inicial e lock estavam desatualizados na Etapa 9. Corrigidos para a unidade ativa Etapa 10, preservando o histórico. O relatório anterior era um esboço: não havia publicação nem novo parecer no SHA documental, e rollout/rollback precisavam de procedimento concreto.
- Checks do head remoto 84f4510 falhos antes de iniciar por cobrança; annotation GitHub conferida. CI/Preview/CodeQL do artefato funcional80a3335 continuam SUCCESS. Delta desde esse artefato exclusivamente documental, confirmado por git diff.
- WRITE_LOCK OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE10-GATE; STATUS=ACTIVE. Escopo: completar packet, plano operacional, acompanhamento DEV, revisão incremental e publicação. Sem código/dependências/workflows novos, merge, DDL/DML compartilhado ou produção.
- PROXIMO_PASSO_EXATO: finalizar docs/execution/manual-scoresheet-stage10-final-gate.md com campos do contrato, evidências e plano de rollout/rollback; validar documentação, fixar commit, publicar packet e obter QA incremental da reconciliação. Manter resultado remoto real explícito.

## 38. Etapa 10 — packet publicado e revisão documental concluída (12/10/2026)

- Packet completo publicado na PR72: https://github.com/renato-lucindo/base-do-basquete/pull/72#issuecomment-6134227073; COMMIT_REVISADO9ca4065ce89358cf5007ee78aa933cbfbf659cda; ARTEFATO_FUNCIONAL80a33355d98dc351214d825557323fa29ebf957b. Commits3b6560e/8365534 preservados e enviados para origin/codex/manual-scoresheet-v2 junto da reconciliação.
- Relatório final: docs/execution/manual-scoresheet-stage10-final-gate.md. Parecer QA Archimedes01a1316e-e9d2-7681-8088-18a92e500f46: APPROVE_WITH_NON_BLOCKING_NOTES,2026-10-12T22:59:49Z, somente fechamento documental. Confirma validade dos três especialistas e do QA local anterior por identidade do artefato; íntegra no relatório. Packet READY; merge/rollout NOT_READY.
- Check documental: diff --check PASS; integridade Markdown3 arquivos/10 links/UTF-8/LF PASS; runbooks5 PASS; agentes7/skills7/cenários21+21 PASS; scan769 PASS. Biome ignorou Markdown (0 arquivos), explicitamente não contado como PASS. Suítes/build/pgTAP não repetidos porque código/SQL/dependências/workflows não mudaram.
- Checks de9ca4065: CI38319647006, CodeQL38319647010, Preview38319647190, Stage438319640755 FAILURE; falhos sem etapas/runner, annotation de cobrança conferida pelo mantenedor e QA. Dependentes SKIPPED. Não alegar checks verdes no novo HEAD. Gates funcionais verdes do80a3335 e logs locais5e4badf permanecem rastreáveis.
- Pendência de rollout descoberta: scripts/supabase-stage4-reconcile-overlay.mjs ainda exige66 arquivos e anuncia4 pendentes; manifesto contém62+6=68. Confirmado por inspeção read-only, sem SQL. Deve ser corrigido/testado em unidade própria antes do preflight; script e migrations preservados nesta entrega documental.
- Acompanhamento separado em docs/execution/manual-scoresheet-stage10-followups.md: preflight bloqueante; seis pacotes high DEV como nota não bloqueante do aceite funcional; integração/release condicionadas a checks, reconciliação, ensaio de backup/compatibilidade e homologação autenticada. Plano concreto de ordem schema/aplicação e recuperação está no packet. Nenhuma issue externa pressuposta.
- SKILL_RESULT: managing-base-work-unit PASS; running-release-gate PASS no escopo documental; READINESS_PACKET=READY; READINESS_MERGE=NOT_READY; READINESS_ROLLOUT=NOT_READY. Etapa10 teve sua entrega documental concluída; o checkpoint de integração do plano não foi declarado verde.
- WRITE_LOCK OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-V2-STAGE10-GATE; STATUS=RELEASED. Delta final registra somente resultados e parecer; será publicado por commit próprio, com SHA final/checks reais no comentário de encerramento da PR. Sem alterações no Supabase compartilhado, merge ou produção.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer.
ARQUIVO_OU_SERVICO: scripts/supabase-stage4-reconcile-overlay.mjs; docs/execution/supabase-stage4-remote-migration-history.json; PR72/Actions.
ACAO: abrir unidade MANUAL-SCORESHEET-ROLLOUT-PREFLIGHT, corrigir contagem/mensagem para o manifesto atual, validar overlay68 arquivos e rejeição de inventário inesperado; obter revisão proporcional e reconciliar histórico read-only antes de planejar aplicação. Reexecutar checks remotos somente após capacidade da conta restabelecida; manter acompanhamento DEV separado.
CRITERIO_DE_CONCLUSAO: gerador/testes e plano dry-run coerentes com as seis pendentes e histórico atualizado, pareceres aplicáveis e checks obrigatórios válidos no SHA a integrar. Merge/main, migrations compartilhadas e produção continuam fora desta entrega; não fazer bypass.

## 39. Preflight e pendências operacionais — unidade ativa (12/10/2026)

- Autorização do responsável: “faça o quie falta”. Base4ece9e7210ebf91e24007099a2b42654edd778e8, árvore limpa e PR72 OPEN/DRAFT nesse SHA. Restrições de merge/main e migrations compartilhadas mantidas; execução local/read-only já autorizada.
- WORK_UNIT=MANUAL-SCORESHEET-ROLLOUT-PREFLIGHT; WRITE_LOCK OWNER=project-maintainer; STATUS=ACTIVE. Aceite: gerador consistente com68 arquivos/seis pendentes, rejeição de inventário inesperado, dry-run verificado sem escrita, revisão proporcional e evidências publicadas. Sem modificar migrations, dados compartilhados, dependências ou proteção de branch.
- Lista remota consultada read-only:62 migrations, última20261005140504; seis pendentes continuam ausentes. CLI instalada2.118.0; db push--help confirma--project-ref/--workdir/--dry-run e alerta sobre Vault; usar também--skip-vault na prévia. Docker não encontrado no PATH/caminho padrão; PostgreSQL17 existe e será inspecionado sem alterar instalação.
- PROXIMO_PASSO_EXATO: corrigir contagem/mensagem e comando de prévia do gerador; adicionar regressões de geração real e rejeição de inventário inesperado, executar gate e dry-run read-only, avaliar ensaio isolado disponível e obter revisão banco/QA no SHA fixo.

### Preflight estabilizado para revisão (12/10/2026)

- Gerador corrigido: total/mensagem derivados do manifesto62+6=68; aliases locais explícitos para as duas versões históricas; marcadores remotos preservados; comando dry-run inclui--skip-vault. SQLs/migrations e lista applied imutáveis.
- Vitest focal4/4 PASS; gate completo68 arquivos/568 testes PASS (320 warnings/27 infos), build/typecheck/runbooks/agentes/scan770. Dry-run remoto EXIT0 propõe exatamente seis migrations, sem seeds/roles. Listagem posterior corresponde integralmente às62 applied, última20261005140504, sem as seis pendentes.
- Relatório/REVIEW_PACKET em docs/execution/manual-scoresheet-preflight-review.md; logs sanitizados em docs/execution/evidence/manual-scoresheet-preflight/. Revisores banco e QA serão acionados no commit fixo; especialistas de estatística/UI não são afetados pelo delta operacional.
- Homologação/recuperação isoladas ainda não executáveis neste host: sem Docker/binários PostgreSQL/servidores encontrados; Supabase só lista main, que não é ambiente isolado. Não criar ambiente pago nem aplicar no compartilhado para contornar. Cobrança GitHub será conferida nos runs após push.
- PROXIMO_PASSO_EXATO: publicar correção/evidências na PR72, obter pareceres banco/QA, conferir Actions; registrar resultado real e pendências externas. Sem repetir o gate completo após delta documental.

## 40. Preflight concluído — pendências externas preservadas (12/10/2026)

- Correção funcional9acc5370564230211004491e79a679a2a95ec8ad publicada na branch correta da PR72; packet https://github.com/renato-lucindo/base-do-basquete/pull/72#issuecomment-6134384991. Gate68 arquivos/568 testes PASS, focal4/4, dry-run remoto exatamente seis pendentes, inventário compartilhado62 inalterado; scan final773 PASS. Logs versionados e hashes conferidos por ambos os revisores.
- Banco Harvey01a1316d-b10c-7db2-b4f9-377dab45dec0: APPROVE_WITH_NON_BLOCKING_NOTES,2026-10-12T23:13:16Z; problema técnico RESOLVIDO, preflight READY. QA Archimedes01a1316e-e9d2-7681-8088-18a92e500f46: APPROVE_WITH_NON_BLOCKING_NOTES,2026-10-12T23:13:40Z; focal próprio4/4 e logs/inventário confirmados. Ambos no mesmo9acc537; pareceres integrais em docs/execution/manual-scoresheet-preflight-review.md. A condição de parecer banco pendente mencionada pelo QA foi satisfeita pelo resultado de Harvey.
- P3 documental do QA corrigido: lock inicial agora aponta BASE4ece9e7 e COMMIT_REVISADO9acc537. Delta após revisão somente documental, sem repetir suítes/build/SQL de artefatos inalterados.
- Actions9acc537: CI38320813742, Preview38320813661, CodeQL38320813647, Stage438320807932 FAILURE; falho inspecionado em cada workflow sem etapas, annotation de cobrança. Não foi feita nova tentativa repetitiva nem alterada cobrança/proteção.
- Responsável respondeu “Ainda não há ambiente isolado”. Homologação autenticada e ensaio representativo de recuperação não foram executados. Não usar main/shared como alternativa nem presumir que pgTAP descarta a necessidade operacional. Não há ambiente Docker/PostgreSQL disponível identificado no host nem branch Supabase isolada.
- Unidade MANUAL-SCORESHEET-ROLLOUT-PREFLIGHT concluída; WRITE_LOCK OWNER=project-maintainer; STATUS=RELEASED. SKILL_RESULT managing-base-work-unit/reviewing-supabase-changes/running-release-gate PASS no preflight. READINESS_PREFLIGHT=READY; READINESS_MERGE/ROLLOUT=NOT_READY. Sem migrações compartilhadas, merge, produção, pagamento ou alteração de dependências.
- Acompanhamento DEV separado preservado. Próximo passo não é aplicar a feature no compartilhado; primeiro capacidade dos Actions e ambiente de ensaio. SHA/checks reais do commit documental de encerramento serão registrados no comentário da PR.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: responsável da conta GitHub para cobrança; project-maintainer para ambiente de homologação.
ARQUIVO_OU_SERVICO: GitHub Billing & plans/Actions PR72; ambiente Supabase isolado a disponibilizar; docs/execution/manual-scoresheet-stage10-final-gate.md.
ACAO: restabelecer capacidade dos jobs sem reduzir gates; disponibilizar ambiente isolado representativo, registrar alvo/custo/backup e executar nele o plano de schema/compatibilidade, login/MFA AAL2, criação/revisão/retry/CAS, histórico/auditoria e ensaio de recuperação; revalidar inventário read-only antes de qualquer aplicação futura.
CRITERIO_DE_CONCLUSAO: checks obrigatórios válidos no SHA final e evidências autenticadas/recuperação aprovadas no ambiente isolado, com revisões proporcionais. Migrations compartilhadas, merge/main e produção permanecem fora desta entrega; não fazer bypass.

## 41. QA isolado Supabase autorizado (13/10/2026)

- Responsável instruiu criar novo banco Supabase se necessário; escolheu organização renato-lucindo(susztsuwjauudvirutdr) e confirmou “criação somente gratuita”, US$0/mês, sem upgrade/adicionais. Novo projeto proposto base-basquete-pr72-qa, região sa-east-1; parar se cota Free impedir.
- Plugin lista organização Free, projeto base-do-basquete ACTIVE_HEALTHY e copa-es-ouro-2026 INACTIVE; nenhum outro alvo será reativado/modificado. get_cost/confirm_cost indisponíveis no servidor (UNAVAILABLE); custo/limites conferidos na documentação oficial e plano Free no painel, autorização explícita registrada acima. Provisionamento via CLI, sem contornar limite de plano.
- WORK_UNIT=MANUAL-SCORESHEET-ISOLATED-QA; WRITE_LOCK OWNER=project-maintainer; STATUS=ACTIVE. Basebf703423046fe76682b6fdaa4177e00799e2b44d; PR72 OPEN/DRAFT e árvore inicialmente limpa. Aceite: projeto distinto e gratuito verificado, migrations/testes somente nele, evidência SQL/auth/recuperação proporcional, pareceres banco/QA e entrega retomável. Sem merge/main, migrations compartilhadas, upgrade/custos ou produção.
- PROXIMO_PASSO_EXATO: criar e verificar projeto Free independente com CLI; confirmar ID diferente de yjnbemfeyjhxhomprlnm antes de qualquer escrita. Preparar schema/testes e credenciais efêmeras protegidas, sem logs/versão de secrets; registrar resultados reais e limitações.

### QA isolado executado — checkpoint para revisão (13/10/2026)

- Projeto base-basquete-pr72-qa(payumtvegfqfejmowxiy), sa-east-1, ACTIVE_HEALTHY/NANO, organização Free confirmada após criação. URL https://supabase.com/dashboard/project/payumtvegfqfejmowxiy. Sem upgrade/add-ons; custo gratuito explicitamente autorizado. Shared yjnbemfeyjhxhomprlnm conferido read-only62/última20261005140504, sem feature aplicada.
-73 migrations do repo aplicadas somente no novo projeto e seed sintética carregada. Executor CLI pgTAP exigiu Docker ausente; runner Python/psycopg com TLS verify-full/CA oficial executou SQL original, includes locais e validação TAP completa.49 arquivos/1.418 assertivas PASS. Primeira execução sem seed foi corrigida na preparação, sem mudar SQL.
- AuthAPI real PASS: anon negado, authenticated não admin false, administradorAAL1 recebe BD401, login/TOTP/challenge geraAAL2 e probe autoriza, payload inválido permanece negado na validação de domínio. Conta sintética/singleton removidos; sem tokens/TOTP versionados. QA visual autenticado completo do wizard não foi executado nesta unidade.
- Recuperação lógica em database qa_pr72_recovery da mesma instância:111 tabelas/545 registros e SHA256 conferem,73 registros de migrations, mais49 arquivos/1.418 pgTAP PASS no recuperado.100 relações/165 funções/124 policies da aplicação conferem em RLS/grants/flags. Nove DEFAULT ACL de papéis gerenciados omitidos por restrição do Supabase; recuperação não cobre configuração GoTrue/secrets/S3/PITR e não é clone fiel da baseline compartilhada.
- Três databases de tentativas incompletas foram removidos; QA postgres e qa_pr72_recovery mantidos. Backup sintético retido somente criptografado DPAPI fora do Git; raw removido. CredencialDB também DPAPI; chavesAPI temporárias removidas. CLI ligada somente em diretório TEMP, sem alterar vínculo do worktree.
- Relatório/packet em docs/execution/manual-scoresheet-isolated-qa.md; logs/resultados/runners em evidence/manual-scoresheet-isolated-qa. Aplicação/SQL/workflows/dependências inalterados; não repetir gate568/build/browser após evidência nova documental. Validar AST/scan/diff e publicar no SHA fixo para revisão de banco/QA.

### Correção após revisão independente (13/10/2026)

- Banco Harvey REQUEST_CHANGES em85dc11d (2026-10-13T12:46:36Z): P2 de asserts removidos por Python otimizado; P3 de escopo da comparação/owners e advisor omitido. Quatro runners agora recusam otimização antes de credenciais/imports externos/rede. Regressões locais3/3 PASS, com16 execuções otimizadas, quatro alvos incorretos e TAP válido/cinco inválidos; sem repetir testes remotos aprovados em modo normal.
- Relatório limita comparação aos campos selecionados e registra --no-owner e nove DEFAULT ACL omitidos. Advisors read-only confirmam auth_leaked_password_protection WARN(1), limitação Pro no QA Free; sem upgrade. Snapshot de performance preservado.
- QA anterior falhou por capacidade do serviço, sem parecer. Renovar banco e QA no commit corrigido. Actions85dc11d CI38398920897/Preview38398920879/CodeQL38398921059/Stage438398912451 falhos antes de etapas por cobrança; merge/rollout NOT_READY.
- WRITE_LOCK permanece ACTIVE/project-maintainer na mesma unidade. PROXIMO_PASSO_EXATO: validar AST/regressões/diff/segredos, commitar e publicar correção na branch da PR72; renovar pareceres independentes no SHA fixo, registrar resultados e status reais, atualizar HANDOFF e publicar fechamento. Shared/main/produção permanecem intocados.

### QA isolado concluído e revisado (13/10/2026)

- COMMIT_REVISADO94f482529878dd625f8dd139002e5964e81e57d5 publicado na branch da PR72; packet https://github.com/renato-lucindo/base-do-basquete/pull/72#issuecomment-6146442207.
- Banco Harvey: APPROVE_WITH_NON_BLOCKING_NOTES,2026-10-13T13:17:31Z, revogando explicitamente REQUEST_CHANGES e confirmando correção dos três achados. QA independente Pascal01a13568-9d5a-7890-aca6-cd55fa4d27fa: APPROVE,2026-10-13T13:20:05Z, mesmo SHA. Ambos executaram regressões offline3/3PASS; relatórios integrais em docs/execution/manual-scoresheet-isolated-qa.md.
- Evidências SQL/Auth/recuperação aprovadas nos limites declarados. Final local: AST/JSON/diff/scan PASS,13 links locais válidos. Código/SQL/dependências/workflows inalterados; gates funcionais anteriores reutilizados. Este fechamento somente registra resultados, sem mudança material do artefato revisado.
- Checks94f4825 CI38403639924/Preview38403639618/CodeQL38403639620/Stage438403629656 FAILURE; quatro annotations de cobrança e CI com zero etapas confirmados por mantenedor/QA. Não houve rerun nem alteração financeira.
- READINESS_UNIDADE=READY; READINESS_MERGE/ROLLOUT=NOT_READY. SKILL_RESULT managing-base-work-unit/reviewing-supabase-changes/running-release-gate PASS neste escopo. WRITE_LOCK OWNER=project-maintainer; STATUS=RELEASED.
- QA Free e database recuperado permanecem disponíveis; nenhuma migration no compartilhado, merge/main ou produção. Preservadas limitações de wizard autenticado completo e recuperação lógica/owners/ACLs/serviços gerenciados; sem upgrade para proteção contra senhas vazadas.

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer para homologação; responsável da conta GitHub para cobrança.
ARQUIVO_OU_SERVICO: projeto QA payumtvegfqfejmowxiy, docs/execution/manual-scoresheet-stage10-final-gate.md e Actions PR72.
ACAO: preparar preview/backend apontados exclusivamente ao QA e executar wizard autenticado completo com MFA, criação/revisão/retry/CAS e histórico/auditoria; documentar cobertura e limites do ensaio de recuperação antes de recomendar rollout. Restabelecer capacidade Actions sem bypass e verificar checks obrigatórios no SHA final; revalidar inventário compartilhado read-only antes de futura aplicação autorizada.
CRITERIO_DE_CONCLUSAO: evidência visual autenticada aprovada, recuperação proporcional ao rollout definida e checks obrigatórios válidos; merge, migrations compartilhadas e produção somente em unidade posterior com gate aprovado.

## 42. Retomada e fechamento do QA isolado (13/10/2026)

- A retomada em `manual-stage4-v3-review` confirmou HEAD `c83662b`, árvore limpa e histórico da PR #72 preservado.
- `AGENTS.md` e este `HANDOFF.md` foram lidos antes da continuação. O estado da seção 41 permanece a fonte de verdade.
- A pendência autorizada de QA visual autenticado do wizard foi analisada. A evidência disponível no repositório comprova SQL/Auth/MFA/recuperação lógica, mas não contém uma execução de navegador autenticado contra `payumtvegfqfejmowxiy`.
- Nesta sessão não foi possível concluir o ensaio visual porque a consulta complementar aos artefatos de E2E foi bloqueada pela ferramenta de execução antes da inspeção dos arquivos. Nenhuma conclusão de aprovação visual foi registrada.
- Não houve alteração no Supabase compartilhado, migrations, merge na main, cobrança GitHub ou produção.

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: e2e do wizard autenticado, projeto QA payumtvegfqfejmowxiy
ACAO: executar navegador autenticado com MFA AAL2 e registrar criação/revisão/retry/CAS, histórico/auditoria e acessibilidade visual; anexar evidências ao packet da PR72.
CRITERIO_DE_CONCLUSAO: evidência visual autenticada aprovada ou limitação documentada, com ambiente QA preservado e sem alterações no Supabase compartilhado.
```

## 43. Preview local para teste humano da súmula — 13/10/2026

- PR72 OPEN/DRAFT e remoto `017d603` confirmados; árvore inicialmente limpa. Projeto QA `payumtvegfqfejmowxiy` ACTIVE_HEALTHY conferido pelo conector.
- Correção do registro da seção42: os outputs daquela sessão mostram erros de sintaxe/glob e comando indisponível, não uma recusa de segurança da ferramenta. A homologação visual continua pendente; não houve comprovação de bloqueio de acesso.
- WORK_UNIT=MANUAL-SCORESHEET-HUMAN-PREVIEW; WRITE_LOCK OWNER=project-maintainer; STATUS=ACTIVE; BASE_COMMIT=017d60324f546382a07e16f4e4aa2515a9b94eab.
- Objetivo/aceite: abrir aplicação real da PR em loopback, conectada exclusivamente ao QA, com acesso administrativo/MFA para teste humano. Sem alterar código funcional, migrations, compartilhado, cobrança, main ou produção. Evidências aprovadas preservadas.
- Escopo: bindings locais ignorados pelo Git, processo local, autenticação sintética somente no QA se necessária e registro operacional. Nenhuma aprovação de QA completo será inferida da abertura do preview.

### Preview aberto e acesso pendente

- Aplicação real iniciada pelo comando `npm run dev -- --host 127.0.0.1 --port 5173`; login aberto e preservado no navegador do Codex em http://127.0.0.1:5173/admin/login. Bindings em `.dev.vars` ignorado apontam exclusivamente para payumtvegfqfejmowxiy; nenhum cliente privilegiado foi entregue à aplicação. Chaves temporárias da CLI removidas após preparo; valores não registrados.
- Consulta read-only no QA:73 migrations, zero registros em private.admin_accounts. O preview responde e renderiza login; autenticação humana ainda não realizada.
- Preparação automática de conta sintética foi rejeitada ANTES da execução por revisão automática: `blocked by policy`. O comando não criou conta, não leu credencial DB e não executou Auth/MFA. Não houve contorno dessa rejeição.
- Aberto também o formulário Authentication > Add user > Create new user no projeto QA, com campos vazios e Auto confirm marcado por padrão; nenhuma submissão. Responsável deve preencher credenciais diretamente no painel, sem enviá-las à conversa. Após criação, mantenedor poderá identificar o UID e registrar o singleton autorizado no QA; depois login/MFA e acesso à súmula pelo preview.
- Código/SQL/dependências/workflows inalterados; suíte/build/pgTAP aprovados preservados, não repetidos. Este checkpoint não aprova QA visual integral nem altera readiness de merge/rollout.
- WRITE_LOCK OWNER=project-maintainer; WORK_UNIT=MANUAL-SCORESHEET-HUMAN-PREVIEW; STATUS=RELEASED (handoff consistente; processo local permanece ativo para teste).
- PROXIMO_PASSO_EXATO: responsável cria a conta QA no formulário aberto; project-maintainer confere UID/alvo e registra singleton somente em payumtvegfqfejmowxiy, depois responsável realiza login/MFA e testa wizard. Aceite: criação/revisão/retry/CAS/histórico/auditoria comprovados; compartilhado/main/produção preservados.
