# HANDOFF — Base do Basquete

> Checkpoint operacional da linha de edições multidimensionais. Histórico detalhado e evidências anteriores permanecem no Git, nas PRs e em `docs/execution/`. Não registrar segredos.

## Checkpoint de retomada — 08/10/2026 — PR3 SQL

- Estado remoto confirmado: PRs draft #66 (base main, HEAD 4865592), #68 (base #66, HEAD 62dcfa9), #69 (base #68, HEAD ec9c4f1) e #73 PR3 (base #69, HEAD 58a1205); validação temporária #74 sobre main no mesmo SHA.
- Runs da PR #74: CI 37781752092: gate e accessibility PASS, database FAIL no pgTAP; CodeQL 37781752041 PASS e preview 37781752184 PASS. O banco concluiu reset/seed, upgrade season/division, divergent edition e manual scheduling antes da falha.
- Causa confirmada: public.admin_create_competition_edition_batch na migration da PR3 encontra referência ambígua a season_id na função private.create_edition_workflow_batch durante multi_dispute_creation_navigation.test.sql. Correção incremental aditiva é necessária; migração PR3 anterior será preservada.
- PR #74 é uma validação temporária sem merge. Não publicar migrations no banco compartilhado nem executar deploy de produção nesta correção.
- Arquivos não rastreados e alterações de outras worktrees pertencem a outras unidades e devem ser preservados.

WRITE_LOCK:
OWNER: project-maintainer
WORK_UNIT: MULTI-DISPUTE-PR3-DB-FIX
BRANCH: codex/pr3-stack-reconcile (publicação para codex/multi-dispute-creation-navigation)
BASE_COMMIT: 58a1205d9eb29f46b3dc898ed2e6c679d4ef0673
SCOPE: correção aditiva PL/pgSQL para falha pgTAP da PR3, testes de banco e registro de evidências.
SCOPE_NEGATIVO: sem merge, compartilhamento de migration, deploy de produção ou alteração das demais worktrees.
REQUIRED_REVIEWERS: database-security-reviewer, accessibility-ui-reviewer, qa-reviewer (PR3 funcional).
STATUS: ACTIVE

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: supabase/migrations e GitHub PR #74
ACAO: corrigir referência ambígua com migration aditiva, validar pgTAP remoto, obter pareceres da PR3 vinculados ao SHA final.
CRITERIO_DE_CONCLUSAO: database CI verde inclusive pgTAP e concurrency, PR #73 atualizada com REVIEW_PACKET e pareceres rastreáveis.
## 1. Unidade corrente e integração

`MULTI-DISPUTE-PR3-STACK-RECONCILE`: atualização da branch PR3 sobre a PR #69 já reconciliada; PR #66 (`codex/season-division-model`) com `main` em 08/10/2026, após a integração da governança documental pela PR #71 (merge `8ac6220`). O conflito de `HANDOFF.md` foi reconciliado com o formato compacto da governança; `docs/plan/README.md` teve merge automático.

Este merge incorpora o histórico reconciliado da PR #69 e preserva a implementação funcional da PR3 (criação múltipla de disputas, navegação adaptativa e auditoria de alterações). Não modifica deliberadamente migrations, contratos de aplicação ou infraestrutura. Os commits funcionais anteriores mantêm sua validade histórica; CI e verificação do HEAD resultante são necessários antes de integrar.

```text
WRITE_LOCK:
OWNER: project-maintainer
WORK_UNIT: MULTI-DISPUTE-PR3-STACK-RECONCILE
BRANCH: codex/multi-dispute-creation-navigation
BASE_COMMIT: f1f2112605d9178b28aa98b579ec8407aa1e0876
SCOPE: incorporar o HEAD reconciliado da PR69 na PR3 e atualizar checkpoint
SCOPE_NEGATIVO: sem novas migrations, alteração de dados no Supabase, merge na main ou produção
REQUIRED_REVIEWERS: database-security-reviewer, accessibility-ui-reviewer, qa-reviewer (delta funcional PR3 ainda não teve parecer final)
STATUS: RELEASED
```

## 2. Sequência das PRs

- PR #66: edição/temporada/divisões; draft sobre `main`; branch `codex/season-division-model`. Commit funcional revisado `4542f44`; último HEAD anterior a este merge `3d27b45`.
- PR #68: cadastro de edição sem naipe, dependente da #66; draft sobre `codex/season-division-model`; funcional `a35366b`, HEAD anterior ao merge `be8cb34`; migration `20261005183643_edition_identity_no_gender.sql` ainda sem rollout compartilhado.
- PR #69: inscrições independentes e cópia transacional, dependente da #68; draft sobre `codex/edition-identity-no-gender`; HEAD anterior ao merge `b9c8d57` publicado em 08/10. Artefato funcional revisado `a5c84f4`.
- PR3: criação múltipla de disputas/navegação e auditoria, funcional `f1f2112`, migração `20261006123600_multi_dispute_creation_navigation.sql`, empilhada na PR #69; aguarda validação remota e pareceres específicos.
- PR4/PR5: importação individual e em lote permanecem etapas posteriores e devem usar unidades/branches próprias.

As PRs são empilhadas e precisam ser conciliadas em ordem. Nenhuma PR desta sequência deve ser tratada como integrada à `main` sem verificação remota.

## 3. Banco e serviços

- Supabase compartilhado: as migrations funcionais da PR #66 `20261002144945_season_division_model.sql` e `20261005124828_edition_creation_workflow.sql` já foram aplicadas em 05/10/2026 com IDs remotos `20261005140439` e `20261005140504`. **Não reaplicar** por divergência de timestamp.
- Após o rollout PR66: cinco temporadas, seis competições, dez jogos, nenhuma disputa sem temporada e nenhum ledger de workflow persistido. Testes pgTAP focais 43/43 em transação revertida; AAL2 em preview verificado sem criação real de edição pela interface.
- Migrations PR1/PR2/PR3 ainda não aplicadas ao Supabase compartilhado neste checkpoint.
- Produção Cloudflare permaneceu inalterada no último checkpoint verificado da PR66. Novo deploy depende de gate apropriado.

## 4. Evidências e riscos

- PR3, funcional local `f1f2112` (base `45e11c7`): 60 arquivos/473 Vitest, Playwright focal 14/14 com Axe, foco/teclado e 390/720/1440 px, typecheck, lint sem erros, build e scan passaram antes das duas correções de auditoria. Correção de P1 prévia para permitir `competition_season_navigation_configured` na constraint de auditoria e correção incremental de trilha foram commitadas em `f1f2112`; gate SQL/pgTAP remoto e renovação de banco/acessibilidade/QA ainda pendentes.

- PR #69, funcional `a5c84f4`: cinco pareceres independentes de banco/segurança, boxscore, estatísticas, acessibilidade e QA, todos `APPROVE` ou `APPROVE_WITH_NON_BLOCKING_NOTES` e nenhum P0–P3; QA `READY`; gate remoto validou migrações/upgrade e 45 arquivos/1.264 pgTAP. Notas não bloqueantes: concorrência focal de RPC copy ainda sem ensaio específico, advisors pós-rollout futuros e cobertura de acessibilidade focal. Não aplicar migration PR2 ao Supabase compartilhado nesta etapa.

- PR #68, funcional `a35366b`: typecheck, 457 Vitest, 8 Playwright focais com axe, build, scan e verificações documentais passaram localmente antes da publicação; SQL/CI/pareceres posteriores devem ser confirmados pelos registros remotos do HEAD funcional. Nenhuma migration PR68 aplicada ao Supabase compartilhado.

- PR #66, funcional `4542f44`: pareceres banco/segurança, acessibilidade e QA `APPROVE`, sem P0–P3; CI, banco/pgTAP, preview e CodeQL verdes no artefato funcional. Os cinco checks antigos também estavam verdes no HEAD `3d27b45`.
- PR #69, funcional `a5c84f4`: pareceres especializados aprovados ou aprovados com notas não bloqueantes; CI (incluindo 45 arquivos/1.264 assertivas pgTAP), preview e CodeQL verdes. No HEAD apenas documental `88d0b13`, os três workflows também estavam verdes. `b9c8d57` ainda não apresentou checks próprios na consulta de 08/10.
- O merge de `main` na PR66 altera a base da pilha: reconfirmar compatibilidade das PRs #68/#69, atualizar seus branches sem force-push e exigir seus checks para os HEADs correspondentes.
- Não declarar aprovação final de release com base apenas nos pareceres de working tree. Manter PRs draft até o gate de integração aplicável.

## 5. REVIEW_PACKET

```text
REVIEW_PACKET:
WORK_UNIT: MULTI-DISPUTE-PR3-STACK-RECONCILE
BRANCH: codex/multi-dispute-creation-navigation
BASE_COMMIT: f1f2112605d9178b28aa98b579ec8407aa1e0876
OBJETIVO: alinhar PR3 à base atualizada da PR69, conservando o checkpoint documental compacto
CRITERIOS_DE_ACEITE: sem conflitos, delta funcional PR3 preservado, gates remotos SQL/CI/preview/CodeQL, pareceres válidos para SHA final
ESCOPO_NEGATIVO: sem nova migration, alteração de banco compartilhado ou deploy em produção
REQUIRED_REVIEWERS: database-security-reviewer, accessibility-ui-reviewer, qa-reviewer
WRITE_LOCK_OWNER: RELEASED
```

## 6. Próximo passo exato

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: GitHub PR draft da codex/multi-dispute-creation-navigation
ACAO: publicar branch/PR3 draft sobre PR69; executar CI/database e pgTAP de reset/upgrade, preview/CodeQL; corrigir falhas e obter pareceres database-security, accessibility e QA válidos para SHA final
CRITERIO_DE_CONCLUSAO: PR3 draft com gates e pareceres vinculados ao SHA sem P0-P3; HANDOFF reconciliado e trabalhos não rastreados preservados
```

## 7. Rastreabilidade

O histórico longo da PR66 permanece em `3d27b45:HANDOFF.md`, o checkpoint da governança em `8ac6220:HANDOFF.md`, os resultados no histórico de comentários/checks das PRs #66/#68/#69 e os pacotes encerrados em `docs/execution/`. Preserve as worktrees em andamento e os não rastreados de outros trabalhos.
