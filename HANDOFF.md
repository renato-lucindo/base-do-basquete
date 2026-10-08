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
HEAD_COMMIT: 39fa5be81ddb600bcd46471b5dba12fe9e448ca0 (confirmado localmente em 08/10/2026; referência de tracking sem divergência reportada por `git status`)
HEAD_FUNCIONAL: d10d048922525eb06d5b14152469170359d7d994 (CI verde)
SCOPE: súmula manual v2, domínio FIBA 2024, persistência aditiva, criação/revisão transacional, wizard e lançamento rápido, testes e documentação da mesma PR
SCOPE_NEGATIVO: sem criação de atleta pela súmula, OCR/parser genérico, alteração dos contratos de importação PDF, conflito com boxscore, Supabase compartilhado, merge final ou produção nesta unidade
REQUIRED_REVIEWERS: database-security-reviewer, statistics-domain-reviewer, accessibility-ui-reviewer, qa-reviewer
STATUS: ACTIVE
```

`statistics-domain-reviewer` está previsto por envolver projeções e isolamento estatístico. Os pareceres bloqueantes da Etapa 4 permanecem pendentes; esta revisão documental não representa aprovação.

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
