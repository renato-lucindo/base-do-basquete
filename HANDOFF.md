## PR #77 — integração autenticada Chromium em stack descartável — 14/10/2026

WORK_UNIT: PR77-FALLBACK-RETRY-HISTORY-20261014; OWNER: project-maintainer; WRITE_LOCK: ACTIVE; BRANCH_LOCAL: codex/pr77-fallback-review-fixes-20261014; BRANCH_REMOTA: codex/keyboard-scoresheet-mvp; BASE_MAIN: be851210da2ba96e4ca78c9cbfac53223ee6862d; HEAD_CONFERIDO: 8aefa8f2f68ecec8eb5949738f2533c08f210b71; PR: OPEN/DRAFT; READY_FOR_MERGE: NO; BLOCK_RELEASE: YES.

EVIDENCIAS: no SHA 8aefa8f, CI 38653184586, CodeQL 38653184648 e Preview 38653184770 PASS, incluindo pgTAP da stack descartável. `npm.cmd run check` local na worktree PASS (68 arquivos, 558 Vitest, formato, lint com 328 avisos não bloqueantes, typecheck, build, runbooks, agentes, scan de segredos). Sintaxe dos scripts e `git diff --check` PASS. O novo Playwright autenticado ainda exige execução no job database do GitHub Actions.

DELTA_ATUAL: `scripts/test-keyboard-disposable-browser.mjs` (novo, integra Chromium, GoTrue/AAL2, FIBA, persistência SQL, falha HTTP/retry idempotente, concorrência e recuperação local), `scripts/test-keyboard-disposable-integration.mjs` (invocação condicional no encerramento do teste AAL2 existente) e `.github/workflows/ci.yml` (instala Chromium e habilita integração de navegador no banco descartável). `worker-configuration.d.ts` foi alterado anteriormente pelo gerador Wrangler; preservar fora do commit. Sem migration ou deploy no Supabase compartilhado, sem merge, sem alteração das PRs #73/#79.

PARECERES: QA 6178910298, banco 6178887733, estatísticas 6178934927 e acessibilidade 6178940422 continuam REQUEST_CHANGES/BLOCK_RELEASE para o SHA antigo. Renovar cada parecer após gates e REVIEW_PACKET atualizados; consultar também boxscore-domain por conciliação FIBA.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=GitHub Actions PR77 job database + `scripts/test-keyboard-disposable-browser.mjs`; ACAO=publicar integração na branch remota, verificar Playwright real em Supabase descartável, corrigir falhas concretas, renovar gates, publicar REVIEW_PACKET e solicitar pareceres independentes; CRITERIO_DE_CONCLUSAO=CI/CodeQL/Preview verdes no SHA definitivo, replay de navegador AAL2 e pgTAP aprovados, pareceres sem bloqueios, PR DRAFT sem merge/produção.

## PR #77 — reconciliação pós-CI do commit 4e0b67c — 14/10/2026

WORK_UNIT: PR77-FALLBACK-RETRY-HISTORY-20261014; OWNER: project-maintainer; WRITE_LOCK: ACTIVE; BRANCH_LOCAL: codex/pr77-fallback-review-fixes-20261014; BRANCH_REMOTA: codex/keyboard-scoresheet-mvp; HEAD_LOCAL_E_REMOTO: 4e0b67c4c690627561ddd96be9230afb48cd6f2c; BASE_MAIN: be851210da2ba96e4ca78c9cbfac53223ee6862d; RISK_LEVEL: CRITICO; PR: OPEN/DRAFT; READY_FOR_MERGE: NO; BLOCK_RELEASE: YES.

EVIDENCIAS: `npm.cmd run check` local PASS (558 Vitest, lint com avisos, formato, tipos, build, runbooks e secrets); GitHub Actions CI 38651849386: gate e accessibility PASS, database FAIL após aplicar migrations no ambiente descartável. pgTAP: 54 arquivos, 1.480 asserções, três falhas: duas em `fiba_historical_transfer_keyboard.test.sql` (pontos esperados 10, observados 0), uma em `keyboard_late_fiba_dispatch.test.sql` (permission denied 42501 impede alcançar o gatilho BD707). CodeQL 38651849346 PASS, Preview 38651849339 PASS. A fixture FIBA declara 10 pontos mas todos os arremessos convertidos são zero; `player_period_stats.points` é gerado a partir das conversões. O teste BD707 realiza UPDATE sob `authenticated` sem grant de UPDATE. A integração real GoTrue/AAL2 ainda não executou neste HEAD porque o job database falhou antes desta etapa. Persistem os quatro pareceres REQUEST_CHANGES anteriores e a necessidade de revisão boxscore conforme contrato.

CORRECAO_INICIAL: no teste histórico, o payload de importação do jogo passa a declarar cinco cestas de dois pontos para o atleta 94141 e verifica a persistência de 10 pontos canônicos; no teste de despacho, verifica a ausência do grant de UPDATE para `authenticated` e exercita o BD707 no papel privilegiado da fixture, sem contexto de writer autorizado. `npm.cmd run check` repetido nesta retomada: PASS, 558/558 Vitest, formato, lint com avisos, tipos, build, runbooks, agente e secrets. O SQL continua aguardando pgTAP remoto descartável.

PRESERVACAO: `worker-configuration.d.ts` continua modificado por geração instrumental de tipos, fora do escopo deste commit; preservar sem reset ou inclusão. Não houve alteração no Supabase compartilhado, em produção, nas PRs #73/#79 ou merge da PR77.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=supabase/tests/database/fiba_historical_transfer_keyboard.test.sql, supabase/tests/database/keyboard_late_fiba_dispatch.test.sql e GitHub Actions PR77; ACAO=ajustar dados de arremesso apenas na fixture do teste histórico, cobrir pontos persistidos, executar BD707 com papel de teste privilegiado sem modificar grants, publicar correção e verificar toda a suíte pgTAP/GoTrue no banco descartável antes de solicitar revisões independentes; CRITERIO_DE_CONCLUSAO=database e integração AAL2 verdes no novo HEAD, pareceres independentes válidos, PR DRAFT sem merge/produção/migrations compartilhadas.

## PR #77 — delta de regressões preparado para validação isolada — 14/10/2026

WORK_UNIT: PR77-FALLBACK-RETRY-HISTORY-20261014; OWNER: project-maintainer; WRITE_LOCK: ACTIVE; BRANCH_LOCAL: codex/pr77-fallback-review-fixes-20261014; BRANCH_REMOTA_PR: codex/keyboard-scoresheet-mvp; BASE: be851210da2ba96e4ca78c9cbfac53223ee6862d; RISK_LEVEL: CRITICO; READY_FOR_MERGE: NO; BLOCK_RELEASE: YES.

As quatro migrations locais de fallback, estatística histórica, desqualificação e PDF tardio foram preservadas. Corrigidas as CTEs inválidas em `keyboard_late_fiba_dispatch.test.sql` e criadas regressões para cinco faltas, D/GD, escopo de autoridade na revisão do fallback, idempotência, transferência pós-jogo FIBA e candidato FIBA real com fixture e conciliação POST01 (sem stub). Evidência anterior do SQL continua pendente de PostgreSQL descartável. `npm.cmd run check` em 14/10: PASS, 68 arquivos/558 Vitest PASS, typecheck, build, formato, lint (328 avisos), runbooks, agente e scan de secrets PASS. O arquivo `worker-configuration.d.ts` permanece modificado exclusivamente por geração de tipos e deve ser preservado fora do commit até decisão específica. Sem operação no Supabase compartilhado ou produção.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=CI/database da PR77 no GitHub Actions, supabase/tests/database/fiba_historical_transfer_keyboard.test.sql, keyboard_late_fiba_real_candidate.test.sql e keyboard_late_fiba_dispatch.test.sql; ACAO=publicar o SHA contendo regressões, verificar migrações e pgTAP desde zero em stack descartável, corrigir qualquer falha, executar GoTrue AAL2 e concorrência, validar preview/CodeQL e publicar REVIEW_PACKET para pareceres independentes; CRITERIO_DE_CONCLUSAO=checks no HEAD publicado e pareceres sem REQUEST_CHANGES/BLOCK_RELEASE; manter PR DRAFT, sem merge, migrations compartilhadas ou produção.

## PR #77 — reconciliação operacional e SQL ainda não validado — 14/10/2026

WORK_UNIT: PR77-FALLBACK-RETRY-HISTORY-20261014; OWNER: project-maintainer; WRITE_LOCK: ACTIVE; BRANCH_LOCAL: codex/pr77-fallback-review-fixes-20261014; BRANCH_REMOTA_PR: codex/keyboard-scoresheet-mvp; HEAD_LOCAL_E_REMOTO: 69fecc4907211f252bbbbf6a7a0d5a44f9fadbf2 (confirmado por `git ls-remote` e API da PR); BASE_MAIN: be851210da2ba96e4ca78c9cbfac53223ee6862d; PR: OPEN/DRAFT. Sem merge, migration compartilhada ou produção.

DELTA_PRESERVADO: `worker-configuration.d.ts` modificado pelo gerador; quatro migrations **não rastreadas**, `20261014224000_keyboard_fallback_revision_guard.sql`, `20261014225000_fiba_historical_registration_statistics.sql`, `20261014225500_keyboard_reject_post_disqualification_scores.sql`, `20261014230000_keyboard_late_fiba_candidate_dispatch.sql`; pgTAP **não rastreado** `supabase/tests/database/keyboard_late_fiba_dispatch.test.sql`. A última migration e o teste foram criados após o commit `69fecc4`; corrigem a informação antiga de que o PDF tardio ainda não possuía implementação local. **Nenhum desses SQLs foi validado em banco nem publicado**. O pgTAP contém duas subconsultas `INSERT ... RETURNING` inválidas e requer correção, regressões e teste sem stub. O gate anterior `npm run check` e 18/18 Playwright cobrem somente o código do commit já publicado, não os SQLs locais.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=supabase/tests/database/keyboard_late_fiba_dispatch.test.sql, quatro migrations 2026101422*/20261014230000, integração em CI da PR77; ACAO=corrigir SQL inválido, conferir roteamento real POST01 de FIBA, criar regressões reais de integridade, executar pgTAP em ambiente descartável e integração AAL2, rodar gates e publicar novo SHA/REVIEW_PACKET; CRITERIO_DE_CONCLUSAO=regressões verificadas no SHA final, pareceres independentes renovados, sem bloqueios; PR permanece DRAFT sem merge.

## PR #77 — checkpoint de validação da interface — 14/10/2026

WORK_UNIT: PR77-FALLBACK-RETRY-HISTORY-20261014; OWNER: project-maintainer; WRITE_LOCK: ACTIVE; BRANCH_LOCAL: codex/pr77-fallback-review-fixes-20261014; BRANCH_REMOTA_PR: codex/keyboard-scoresheet-mvp; BASE_HEAD_VERIFICADO: a3e60a84164c312d4f58b10e1278f1fc0e0c1f0c; PR: OPEN/DRAFT. Nenhum merge ou deploy; Supabase compartilhado inalterado.

VALIDACAO_LOCAL: Playwright Chromium `e2e/keyboard-scoresheet.spec.ts --workers=1`: 18/18 PASS, incluindo recuperação divergente por dois reloads (localStorage preservado), tentativa de digitação sob ancestral `inert`, descarte explícito, Ctrl+Z/Ctrl+Y, anúncios e erro de participação com camisas iguais em equipes opostas. Duas regressões inicialmente falhas foram ajustadas para representar corretamente o comportamento nativo de `inert` e a rejeição da alteração de participação. Vitest focal 44/44 PASS; `npm run check`: PASS (Vitest global 558/558, format, lint, typecheck, runbooks, agentes, build, varredura de segredos); `git diff --check`: PASS. `worker-configuration.d.ts` foi regenerado pelo typecheck com versão atualizada do workerd; preservar o diff até decidir sobre versionamento.

PENDENCIAS: 3 migrations SQL locais não rastreadas (20261014224000, 20261014225000 e 20261014225500) ainda exigem revisão e pgTAP de segurança, histórico e desqualificação; PDF tardio P2-B não implementado; integração autenticada P2-A ainda não ensaiada no novo delta. A leitura em lote das migrations pelo Codex Native foi bloqueada pela plataforma nesta retomada; não foi feita revisão do conteúdo por esse caminho. Docker e psql indisponíveis neste Windows; usar Supabase descartável em Actions para pgTAP após verificação. Não publicar migrations sem validar. Os quatro REQUEST_CHANGES anteriores continuam bloqueantes.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=supabase/migrations/20261014224000_keyboard_fallback_revision_guard.sql, 20261014225000_fiba_historical_registration_statistics.sql, 20261014225500_keyboard_reject_post_disqualification_scores.sql, migration aditiva de conciliação PDF, supabase/tests/database e GitHub Actions da PR77; ACAO=revisar os contratos SQL, implementar a conciliação controlada do PDF tardio e pgTAP, executar integração GoTrue/AAL2 e concorrência em stack descartável, validar gates, publicar REVIEW_PACKET e solicitar quatro revisões independentes válidas; CRITERIO_DE_CONCLUSAO=todos dez achados cobertos e gates verdes no HEAD publicado, quatro pareceres independentes sem bloqueios, PR mantida DRAFT sem merge, migração compartilhada ou deploy.

## PR #77 — retomada dos bloqueios independentes — 14/10/2026

WRITE_LOCK:
OWNER: project-maintainer
WORK_UNIT: PR77-FALLBACK-RETRY-HISTORY-20261014
BRANCH: codex/pr77-fallback-review-fixes-20261014
HEAD_COMMIT: a3e60a84164c312d4f58b10e1278f1fc0e0c1f0c
SCOPE: corrigir os cinco P1 e cinco P2 dos pareceres 6178910298, 6178887733, 6178934927 e 6178940422, testes, migration aditiva, documentação e publicação somente na PR #77.
SCOPE_NEGATIVO: sem migrations em Supabase compartilhado, dados ou deploy de produção, merge, alterações nas PRs #73/#79, ou descarte de mudanças de terceiros.
RISK_LEVEL: CRITICO
REQUIRED_REVIEWERS: database-security-reviewer, statistics-domain-reviewer, accessibility-ui-reviewer, qa-reviewer; avaliar também boxscore-domain-reviewer pelo contrato de fontes.
STATUS: ACTIVE

O HEAD remoto confirmado pela API da PR é a3e60a8; a PR permanece DRAFT. A unidade retoma após quatro REQUEST_CHANGES de revisores independentes; CI verde anterior não encerra os novos bloqueios. O worktree isolado iniciou limpo. O HANDOFF anterior da PR77 descreve estado anterior aos pareceres e é preservado abaixo como histórico.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=migrations SQL, app/modules/keyboard-scoresheet, rota de seleção, testes/Actions e PR77; ACAO=implementar e validar os dez achados com migration aditiva, publicar commits e packet e solicitar os pareceres; CRITERIO_DE_CONCLUSAO=regressões e gates no HEAD corrigido, pareceres independentes válidos e nenhum bloqueio crítico; manter PR DRAFT sem merge.
# HANDOFF — Base do Basquete

## PR #77 — fallback emergencial, retry e revisão histórica (14/10/2026)

WORK_UNIT=PR77-FALLBACK-RETRY-HISTORY-20261014; OWNER=project-maintainer; BRANCH_REMOTA=codex/keyboard-scoresheet-mvp; BASE_HEAD=cebed5c319e86da4d622e637db0d64718193b5d5; WRITE_LOCK=RELEASED após CI/pgTAP/GoTrue no HEAD_FUNCIONAL=c27c6639eb49c1455148ecaccc4e920ca7d81c21; RISK_LEVEL=CRITICO; PR=OPEN/DRAFT.

OBJETIVO: resolver P1 fallback manual de súmula por teclado em competição de fonte FIBA exigindo justificativa e submissão de papel fallback; P2 falhas transitórias HTTP e retry idempotente; P2 revisão de elencos históricos após transferência. Migration aditiva 20261014223000_keyboard_fallback_history.sql substitui somente a implementação da RPC, preservando migration anterior e vínculos autoritativos. Novos testes: keyboard_emergency_fallback.test.sql (rascunho, justificativa, papel fallback, autoridades, auditoria, finalização explícita) e teclado histórico; rota administrativa e editor agora expõem fallback e fonte histórica. Nenhuma migration executada no Supabase compartilhado ou em produção.

RISCOS_ABERTOS: quatro pareceres independentes (database-security, statistics, accessibility e QA) ainda não recebidos; o antigo REQUEST_CHANGES exige novo parecer. Evidência funcional: CI 38633401131 SUCCESS (gate/database/accessibility, 51 arquivos/1.438 pgTAP, teste keyboard×PDF e GoTrue TOTP/AAL2 PASS), CodeQL 38633401129 SUCCESS, Preview 38633401127 SUCCESS, todos no HEAD_FUNCIONAL=c27c6639. Nenhum gate verde substitui parecer independente. Escopo negativo: sem PR72, outras worktrees, produção ou merge. O checkout Windows citado no handoff anterior não é acessível nesta sessão; commits desta unidade publicados diretamente pelo GitHub Connector na branch PR, preservando o restante da árvore.

PROXIMO_PASSO_EXATO: RESPONSAVEL=revisores independentes e project-maintainer; SERVICO=GitHub PR #77; ACAO=obter pareceres read-only database-security, statistics-domain, accessibility-ui e QA para o commit funcional c27c6639 com confirmação do delta documental posterior, atualizar REVIEW_PACKET e decidir liberação somente após quatro pareceres sem objeções críticas; CRITERIO_DE_CONCLUSAO=pareceres independentes válidos no HEAD e gates já verdes confirmados; sem merge/migration compartilhada/produção até autorização formal.


## PR #77 — ensaios reais de integração (14/10/2026)

WORK_UNIT=PR77-DISPOSABLE-INTEGRATION-GATE; OWNER=project-maintainer; BRANCH_LOCAL=codex/pr77-main-reconcile-20261014; BRANCH_REMOTA=codex/keyboard-scoresheet-mvp; BASE_HEAD=e393a6cd80e53271b0b238d82decd855b954193d; WRITE_LOCK=ACTIVE; RISK_LEVEL=CRITICO; PR DRAFT.

OBJETIVO: incorporar ao GitHub Actions provas reproduzíveis de concorrência entre escritores keyboard/legado e autenticação GoTrue/MFA TOTP AAL2, usando exclusivamente a stack Supabase descartável. ESCOPO_NEGATIVO: sem migrations em Supabase compartilhado, sem produção, sem merge, sem PR #72 e sem outras worktrees. Os pareceres de banco/acessibilidade não foram concluídos devido a sessões de agentes desconectadas/interrompidas; renovar após o commit e a conclusão dos gates.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; SERVICO=GitHub Actions / PR77; ACAO=implementar e executar os ensaios de GoTrue/PostgREST AAL2 e corrida keyboard em banco descartável, colher pareceres críticos renovados e registrar o REVIEW_PACKET; CRITERIO_DE_CONCLUSAO=jobs verdes no HEAD publicado e quatro pareceres independentes válidos antes de liberar integração.

## PR #77 — correção do pgTAP em CI — 14/10/2026

WORK_UNIT=PR77-PGTAP-VALID-SCORE-FIX; OWNER=project-maintainer; BRANCH_LOCAL=codex/pr77-main-reconcile-20261014; BRANCH_REMOTA=codex/keyboard-scoresheet-mvp; BASE_HEAD=be15e9c99d202ff252dce363af88b68fcc48c9cb; WRITE_LOCK=RELEASED após commit/push; RISK_LEVEL=CRITICO; PR DRAFT.

CI 38611605674 no HEAD be15e9c: gate e accessibility PASS, CodeQL 38611605602 PASS, preview 38611605540 PASS. Job database FAIL apenas no pgTAP `keyboard_scoresheet.test.sql` linha 193: `KEYBOARD_SCORE_OR_OVERTIME_INVALID` (BD902), após migrations fresh/upgrade PASS. Os novos cenários D/GD tentavam confirmar jogos com placar 0–0, proibido pela própria RPC. Ajustadas somente duas fixtures desses testes com uma cesta válida de dois pontos do time mandante. `git diff --check` PASS; Docker ausente no Windows; SQL integral requer GitHub Actions. Migrações permanecem imutáveis; não executar no Supabase compartilhado nem produção. Os pareceres independentes anteriores ao HEAD são históricos, não aprovações da revisão atual.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; SERVICO=GitHub PR77 / CI e revisores; ACAO=conferir pgTAP no CI do novo HEAD publicado, corrigir quaisquer falhas remanescentes, obter quatro pareceres independentes válidos e executar GoTrue/PostgREST AAL2 e concorrência em ambiente isolado; CRITERIO_DE_CONCLUSAO=database, CI, CodeQL e preview verdes, ensaio autenticado, concorrência e revisores aprovados no HEAD antes de considerar merge. Manter DRAFT.

## PR #77 — correções de bloqueios críticos — 14/10/2026

WORK_UNIT=PR77-CRITICAL-REVIEW-FIXES; OWNER=project-maintainer; BRANCH_LOCAL=codex/pr77-main-reconcile-20261014; BRANCH_REMOTA=codex/keyboard-scoresheet-mvp; BASE=cc32c70; WRITE_LOCK=RELEASED após publicação das correções, sujeito a novo lock em caso de REQUEST_CHANGES; RISK_LEVEL=CRITICO; PR DRAFT.

Os bloqueios dos revisores anteriores foram tratados por migration ADITIVA `20261014180500_keyboard_public_player_statistics.sql` (GD/D e isolamento de inscrição) e editor acessível (camisa duplicada, ação inválida, motivo da revisão), com regressões pgTAP/Playwright. Nenhuma migration antiga foi modificada. Localmente: 12 Playwright PASS, `npm run check` PASS (550 Vitest, typecheck, formato, lint com 328 avisos, build, segredos); PostgreSQL integral não executado por ausência de Docker. Os resultados do CI, quatro pareceres renovados, autenticação GoTrue/PostgREST AAL2 e concorrência entre escritores ainda precisam ser comprovados. Evidência: `docs/execution/PR77-CRITICAL-REVIEW-FIXES-20261014.md`. Sem alteração em Supabase compartilhado, produção, PR #72 ou outras worktrees.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; SERVICO=PR77 / SHA remoto; ACAO=conferir CI/database/preview/CodeQL, obter pareceres independentes de banco/estatísticas/acessibilidade/QA e validar GoTrue/PostgREST AAL2 + concorrência em ambiente isolado; CRITERIO_DE_CONCLUSAO=gates completos, sem parecer bloqueante, antes de considerar merge. Manter DRAFT durante pendências.

## PR #77 — substituição da entrada antiga pelo lançamento por teclado — 14/10/2026

WORK_UNIT=PR77-KEYBOARD-ENTRY-REPLACE; OWNER=project-maintainer; BRANCH=codex/keyboard-scoresheet-mvp; WRITE_LOCK=RELEASED após entrega da branch e preview; HEAD_FUNCIONAL=4a47f8bdee9cafbde34cb540ce4a006d49776d59; COMMIT_INICIAL=d00f9d6; MERGE_REMOTO=b045850; BASE_MAIN=be85121; RISK_LEVEL=CRITICO.

Em admin/competitions/:competitionId/scoresheets/new, o editor legado de grade foi substituído pela seleção do jogo e entrada no editor por teclado, com redirecionamento para o único jogo elegível. A tela orienta sobre jogo, inscrição, elenco e migration ausentes. O editor permanece em admin/games/:gameId/scoresheet/keyboard com camisa/valor, faltas, períodos e histórico. Após PR79/PR73, seleção e cabeçalho preferem public_name da inscrição. A importação do boxscore permanece inalterada.

Gate da implementação reconciliada em checkout isolado do HEAD funcional 4a47f8b: npm ci com 166 pacotes auditados, zero vulnerabilidades; npm run check PASS (550 Vitest em 68 arquivos, formato, lint, typecheck, runbooks, agentes, build, secrets 753); 9 Playwright/Chromium da interface por teclado PASS, inclusive foco, equipe/período, edição/undo, compensação, recuperação, reflow 390/720/1440 e temas. Preview atualizado por Wrangler versions upload: aa44872d-3d11-49fd-99b1-d9e4ca7abe8b (alias pr-77). Smokes MVP de segurança/privacidade e contexto público PASS. Smoke autenticado, migrações SQL/pgTAP no novo HEAD, CI/CodeQL e pareceres independentes seguem PENDENTES; fixture do Playwright não substitui autenticação real. A tela evita lançamento quando migration keyboard não existe no banco de preview. Sem migrations no Supabase compartilhado, produção ou merge na main.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; SERVICO=PR77 / codex/keyboard-scoresheet-mvp; ACAO=colher pareceres independentes database-security/statistics/accessibility/QA no SHA funcional e confirmar CI/CodeQL, validar banco SQL/pgTAP e ensaio autenticado GoTrue/PostgREST em ambiente descartável com migration teclado, depois decidir rollout; CRITERIO_DE_CONCLUSAO=SQL/CI/reviews/autenticação válidos, sem efeitos no Supabase compartilhado ou produção antes da autorização de release.
## PR #77 — reconciliação com main após #79/#73 — 14/10/2026

WORK_UNIT=PR77-MAIN-RECONCILE-20261014; OWNER=project-maintainer; BRANCH_LOCAL=codex/pr77-main-reconcile-20261014; BRANCH_REMOTA=codex/keyboard-scoresheet-mvp; BASE_HEAD=1df666858180d652f103eff5c182fb0c1d0ebb91; MAIN_INTEGRADA=be85121; WRITE_LOCK=RELEASED após reconciliação e validação local; somente a branch isolada recebeu alterações.

Objetivo: incorporar a main atual à PR77, conservando a súmula por teclado independente, correções de jogos e contratos de inscrições/disputas já integrados. Escopo negativo: PR72 encerrada, worktrees de terceiros, migrations no Supabase compartilhado, produção e merge na main. A evidência local de 545 Vitest (66 arquivos), gerada em codex/pr77-manual-scoresheet-replacement@086c73d, corresponde a outra implementação e não deve ser atribuída à PR77 por teclado. Gates remotos anteriores de PR77 (1df6668) ficaram verdes, mas serão renovados se o HEAD funcional mudar.

RISK_LEVEL=CRITICO; REQUIRED_REVIEWERS=database-security-reviewer, statistics-domain-reviewer, accessibility-ui-reviewer, qa-reviewer; revisão independente no HEAD reconciliado, pgTAP, GoTrue/PostgREST AAL2, CI, CodeQL e preview são pendentes. Manter draft sem integração até pareceres válidos e decisão de release formal.

Conflitos de merge restritos a HANDOFF e à união das assinaturas `admin_save_keyboard_scoresheet` e `admin_create_competition_edition_batch` em `app/types/database.generated.ts`; rotas ajustadas automaticamente. `npm.cmd ci` PASS (166 pacotes auditados, zero vulnerabilidades); `npm.cmd run check` PASS (542 Vitest, lint com 328 avisos não bloqueantes, typecheck, runbooks, agentes, build e scan de 753 arquivos). O arquivo `worker-configuration.d.ts` foi regenerado por `npm ci` e é alteração instrumental fora do delta de integração; restaurar a versão rastreada antes do push. A validação de SQL/pgTAP, preview, CodeQL e testes de navegador será exigida do CI da nova cabeça.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=PR #77 / codex/keyboard-scoresheet-mvp; ACAO=concluir reconciliação e executar gates no novo HEAD, publicar REVIEW_PACKET, obter pareceres independentes CRITICOS e ensaio autenticado isolado; CRITERIO_DE_CONCLUSAO=CI/database/preview/CodeQL verdes, aprovações válidas, GoTrue/PostgREST e integridade confirmados, sem migração compartilhada ou produção.

## Registro histórico — PR77 antes da main de 14/10

## PR #77 reconciliada após UI/boxscore — 13/10/2026

WORK_UNIT=PR77-KEYBOARD-SCORESHEET-MAIN-RECONCILE; OWNER=project-maintainer; BRANCH=codex/keyboard-scoresheet-mvp; STATUS=RELEASED. Branch do novo editor por teclado reconciliada com main@f29d8ba620d8 (PR63 e PR65). A rota legada preserva POST/303 e naipe, e os novos links de retomar/lancar súmula por teclado foram adicionados sem conflito. A PR #72 permanece cancelada, sem merge. Branch continua DRAFT/RISCO CRITICO; é proibido integrar sem revisões independentes atuais de database-security, statistics, accessibility e QA, validação autenticada GoTrue/PostgREST e rollout compatível de migration. Nenhum deploy, merge na main ou mutation no Supabase compartilhado.

## Revisoes e integracoes79 e73 concluidas - 14/10/2026

Este checkpoint substitui operacionalmente os registros historicos abaixo. PR79 MERGED por cfb461425b76d0a738e915bb6925025ff7c635b4, com banco/boxscore/estatisticas/QA aprovados e QA editorial6166528738. PR73 MERGED por squash467d9e40ae559dc6d5bcf123a11fbd41f1c3a282, com banco6167075596, acessibilidade6167092759 e QA6167114151 aprovados noHEADc1323c3. As arvores integradas foram verificadas identicas aos HEADs aprovados. Todos os bloqueios anteriores foram encerrados por novos pareceres independentes; CI nao foi usado como aprovacao ficticia.

Gates finaisPR73: CI38554674459/preview38554674418/CodeQL38554674383 SUCCESS;512Vitest,17Playwright(2skips),49arquivos/1347pgTAP,fresh/upgrade/concorrencia/PostgREST/scan732. Gates finaisPR79 e posmerge, SHAs, pareceres, correcoes, riscos e preservacao estao em docs/execution/PR79-PR73-INTEGRATION-20261014.md. Unidades79/73 COMPLETE, WRITE_LOCK=RELEASED; revisores encerrados. Registro editorial de encerramento sem alteracao funcional ou normativa.

Issue84 acompanha deadlock potencial entreUUIDsdistintos, nota nao bloqueante ainda nao reproduzida. Limitacoes de A/B+inversao/supplemental, shell herdado, zoom nativo e MFAreal permanecem documentadas. PR77 permaneceu em1df666858180d652f103eff5c182fb0c1d0ebb91, intocada. Nenhuma migration compartilhada ou producao nesta unidade. IDs remotosPR66 20261005140439/20261005140504, worktrees/untracked e branches de preservacao foram mantidos. WIPsdepausa nao foram integrados.

PROXIMO_PASSO_EXATO: a unidade autorizada79/73 terminou. Proxima investigacao da fila eissue84, em unidade propria e banco descartavel, com barreiras de concorrencia, resultado sem40P01/estado parcial e revisao independente. Rollout compartilhado/advisors/MFAreal e producao exigem outra unidade e autorizacao; nao foram iniciados.

## PR73 - correcoes dos pareceres independentes - 14/10/2026

WORK_UNIT=PR73-INDEPENDENT-FINDINGS-FIX; OWNER=project-maintainer; BRANCH_REMOTA=codex/multi-dispute-creation-navigation; BASE=cfb461425b76d0a738e915bb6925025ff7c635b4; WRITE_LOCK=ACTIVE ate push para renovacao. HEAD anterior7156f60 teve banco APPROVE_WITH_NON_BLOCKING_NOTES(6166742820), acessibilidade REQUEST_CHANGES(6166834700) e QA REQUEST_CHANGES(6166869794). CI38552252383/preview38552252332/CodeQL38552252316 SUCCESS:503Vitest,15Playwright,48arquivos/1331pgTAP. CI nao substitui os bloqueios.

Correcoes focais: erros de identificacao no validador batch conservam o campo compartilhado; erros proprios da disputa conservam prefixo/index. Ano/Nome agora visiveis com aria-invalid/describedby e alerta focado; duas regressoes Playwright PASS. Confirmacao HTTP validada por origem/AAL2/CSRF/contrato/requestUUID/revisao alcança RPC antes de escolhas mutaveis, preservando replay de adicao e guardas autoritativos; revisao sem escrita mantem preflight. Confirmacao incompleta continua na etapa Revisao.

Migration aditiva20261014110514 reconcilia somente expectativas de perfil alteradas pelo proprio lote: registra expectativa original e perfil do item concluido por categoria/idade/naipe, substitui a expectativa dos itens seguintes somente quando corresponde ao mesmo original. O primeiro item continua validado contra o perfil ativo, com locks transacionais; expectativa externa ou divergente permanece rejeitada. Ledger externo conserva payload original. Novos16pgTAP cobrem Ouro/Prata na mesma categoria/naipe, replay, umperfil e rejeicoes/rollback de expectativas divergentes/externas e fonte alterada semjustificativa. Migrations publicadas anteriores inalteradas. SQL so emCI descartavel, sem Dockerlocal. Gate local da correcao PASS512Vitest/66arquivos e todosgates npmruncheck, scan732; duasregressoesPlaywrightPASS. Artefato deve receber SQL integral e novos pareceres.

NotaDB nao bloqueante sobre deadlock entreUUIDsdistintos acompanhada em issue84; ainda nao reproduzida. Shell herdado: nome acessivel do brand em390px e movimento reduzido foram observados como limitacoes daBASE por Popper; nao sao regressao destaPR. Rollout/MFAreal/zoomnativo/advisorsprodutivos continuam limitacoes explicitadas. Sem PR77, DDL compartilhado ou producao. PR79 integrada emcfb4614, com gatesposmerge38551883368/38551883396 SUCCESS.

PROXIMO_PASSO_EXATO: estabilizar e publicar correcoes com gate; renovar banco/acessibilidade/QA noSHAexato; integrar73 somente semREQUEST_CHANGES e comgatesverdes. Preservar worktrees/WIP e IDs remotos historicosPR66.

## PR73 - reconciliacao e revisoes independentes - 14/10/2026

Este checkpoint substitui operacionalmente as instrucoes historicas abaixo. PR79 MERGED em2026-10-14T10:46:11Z por cfb461425b76d0a738e915bb6925025ff7c635b4; arvore identica ao HEAD7e37821 aprovado. Quatro pareceres independentes e QA editorial6166528738 validos; CI38551232484/preview38551232491/CodeQL38551232516 SUCCESS. Nenhum rollout compartilhado ou producao realizado.

WORK_UNIT=PR73-MAIN-RECONCILE-INDEPENDENT-REVIEW; OWNER=project-maintainer; BRANCH_LOCAL=codex/pr73-main-independent-review; BRANCH_REMOTA=codex/multi-dispute-creation-navigation; BASE_COMMIT=cfb461425b76d0a738e915bb6925025ff7c635b4; HEAD_INICIAL=f3b1a5ddb426a0edd1a40bd6c445f2721945238a. WRITE_LOCK=ACTIVE ate publicar arvore estavel. Merge de main apresentou conflito somenteHANDOFF; preservadas as evidencias recentes e o checkpoint historico73. Os17arquivos incrementais do pacote mantidos; sem funcionalidade daPR77. Migrations publicadas20261006123600 e20261008104500 imutaveis.

Packet original6157258955: wizard Identificacao/Disputas/Revisao, criacao transacional de1-12disputas, navegacao categoria/divisao, AAL2 e idempotencia. Revisores obrigatorios banco/seguranca, acessibilidade e QA; estatisticas/boxscore dispensados apenas neste incremento sem alterar seus dominios, dependencia79 revisada. Validacao estabilizada: scripts descartaveis CI agora verificamRPCbatch viaPostgREST para anonimo, nao-adminAAL2, adminAAL1 e adminAAL2 com payloadinvalido, e concorrencia de retry com um ledger/auditoria/divisao e doisIDs de disputa. Gate local npm run check PASS:503Vitest/66arquivos, format/lint/typecheck/runbooks/agentes/build/scan730. SQL/concorrencia/PostgREST aguardamCI descartavel; Dockerlocal ausente. Publicar novo packet comSHA exato e CI/preview/CodeQL. WRITE_LOCK=RELEASED apos push para revisoes independentes. Nao integrar ate pareceres independentes validos e gates verdes.

Sem PR77, DDL compartilhado ou deploy de producao. Supabase compartilhado ainda sempublic_name; IDs remotos historicosPR66 20261005140439/20261005140504 preservados. MFAreal/rollout/advisors produtivos permanecem unidade posterior. Worktrees/WIPs440a0b1/cd906eb e trabalho alheio137b78b preservados; nenhum deles introduzido nesta integracao.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; SERVICO=PR73; ACAO=estabilizar/revisar diff, publicar gate/packet e colher banco/acessibilidade/QA; integrar por squash somente aprovada; CRITERIO=PR73MERGED comSHAgatespareceres verificaveis, sem PR77/Supabasecompartilhado/producao.

## Checkpoint PR #73 reconciliada — 13/10/2026

WORK_UNIT=RECONCILE-PR73-WITH-PR79; OWNER=project-maintainer; BRANCH=codex/multi-dispute-creation-navigation; STATUS=RELEASED. PR3 reconciliada com a base `codex/independent-registrations-copy@ced8a76e19ce`, preservando UI pública PR63, correção de boxscore PR65, integridade de divisões PR79, e os 17 arquivos incrementais da criação múltipla. CSS foi conciliado aplicando o hunk da PR3 sobre o CSS atual, sem perda das regras públicas. O pgTAP de PR3 passou anteriormente em validação temporária #81: 46 arquivos/1.292 testes; a nova árvore exige gate próprio. NÃO INTEGRAR enquanto #79 não for aprovada e incorporada à main com plano de migrations remoto. Sem DDL no Supabase compartilhado nem produção.


## PR79 - pareceres concluidos e ajuste editorial final - 14/10/2026

Este checkpoint substitui operacionalmente as instrucoes historicas abaixo. A pausa por uso terminou apos reset:0% da janela5h, sem consumir credito de reset. Checkpoint WIP440a0b1 em codex/pr79-review-pause-bb3d4ac preservado fora da integracao.

WORK_UNIT=PR79-EDITORIAL-UTF8-FINAL; OWNER=project-maintainer; BRANCH_REMOTA=codex/independent-registrations-copy; BASE=f29d8ba620d8d64697874a7958f53f601671a63c; HEAD_FUNCIONAL=bb3d4ac4526ad8a8ebafe287a75eb8b2e2702a9d. WRITE_LOCK=ACTIVE durante ajuste editorial, RELEASED apos push para revisao incremental.

Quatro pareceres independentes validos no HEAD funcional: banco Harvey APPROVE_WITH_NON_BLOCKING_NOTES(6162129056), boxscore Noether APPROVE_WITH_NON_BLOCKING_NOTES(6162129258), estatisticas Linnaeus APPROVE(6162124335), QA Hilbert APPROVE_WITH_NON_BLOCKING_NOTES(6162155848). Todos os P2 anteriores encerrados por nova revisao dos dominios. Packet6162072514. CI38520319192/preview38520318802/CodeQL38520318821 SUCCESS:493Vitest,47arquivos/1303pgTAP, fresh/upgrade/concorrencia/PostgREST; detalhesHTTP200 no previewimutavel7b320b43. Gate local493Vitest/65arquivos e scan724 PASS. Codigo e testes permanecem identicos neste ajuste; apenas HANDOFF e codificacao UTF8 normalizada, encerrando P3 documental de QA. Confirmacao incremental antes do merge, sem repetir gates funcionais inalterados.

PR79 ainda nao integrada. PR73 ainda f3b1a5ddb426a0edd1a40bd6c445f2721945238a, nao revisada nesta execucao. Apos merge79: reconciliar73 com main em worktree isolado, preservar delta17arquivos, resolver HANDOFF, retarget main, publicar packet e renovar banco/acessibilidade/QA. Integrar somente com gates e pareceres validos.

Sem PR77, DDL no Supabase compartilhado ou deploy de producao. Rollout reconciliado/MFAreal/advisors produtivos permanecem pendentes. IDs remotos historicosPR66 20261005140439/20261005140504 preservados. Incremento alheio137b78b preservado remotamente em codex/preserve-roster-import-137b78b; nenhum WIP de pausa deve entrar na main. Limites A/B+inversao/supplemental seguem notas nao bloqueantes de cobertura.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; SERVICO=PR79; ACAO=confirmar delta editorial e validade dos pareceres/gates, integrar79 por mergecommit, depois reconciliar/revisar73; CRITERIO=ambas integradas apenas aprovadas, sem PR77/Supabase compartilhado/producao.

## Correção focal de compatibilidade pública — 14/10/2026

WORK_UNIT=PR79-PUBLIC-DETAIL-LEGACY-COMPAT; OWNER=project-maintainer; BRANCH_LOCAL=codex/pr79-boxscore-final-persistence; BRANCH_REMOTA=codex/independent-registrations-copy; BASE=f29d8ba620d8; WRITE_LOCK=ACTIVE durante correção, RELEASED após push/revisão.

Artefato354709d: banco Harvey e boxscore Noether APPROVE_WITH_NON_BLOCKING_NOTES, pareceres6162004100/6161987055. CI38519060395/preview38519060399/CodeQL38519060411 SUCCESS:486Vitest,47arquivos/1303pgTAP, fresh/upgrade/concorrência/PostgREST. Estatísticas Linnaeus e QA Hilbert REQUEST_CHANGES por detalhes de jogo/equipe sem fallback de public_name no schema anterior (HTTP500 no preview). Achados anteriores de fingerprints, perfil/histórico/snapshots, retry e persistência A/B foram resolvidos.

Correção focal adiciona fallback restrito aos códigos de incompatibilidade conhecidos nos loaders reais de jogo, lista/detalhe de equipe; mantém filtros de competição/status/participantes, nomes/slugs legados e identidade A/B nova, sem esconder falhas de autorização. Regressões abrangem42703/PGRST204, dois formatos de URL, snapshot real, contexto incorreto, placares A/B e erro42501. Smoke de preview passa a exigir200 dos detalhes vinculados, além das listas. SQL/grants/migrations inalterados. Gate local da correção PASS:493Vitest/65arquivos, formatação/lint/typecheck/build/runbooks/agentes/segredos(724). Revisão do novo SHA obrigatória; nenhum merge com REQUEST_CHANGES aberto.

PROXIMO_PASSO_EXATO: publicar correção após gate local; renovar estatísticas/QA e confirmar validade focal de banco/boxscore; conferir CI/preview/CodeQL e detalhesHTTP200; integrar79 somente aprovada, depois reconciliar/revisar73. Sem PR77, DDL compartilhado ou produção. IDs remotos históricos PR66 preservados. Trabalho alheio137b78b permanece em codex/preserve-roster-import-137b78b; WIPcd906eb permanece isolado.

## Retomada após reset — PR79 boxscore ponta a ponta

O heartbeat autorizado retomou o trabalho em 14/10/2026 02:36 America/Araguaina; janela de5h consultada em0%, sem usar crédito de reset. A pausa terminou. Este checkpoint substitui operacionalmente as instruções históricas abaixo. Evidência da pausa em `codex/pr79-review-handoff@cd906eb`, `docs/execution/PR79-INDEPENDENT-REVIEWS-PAUSED.md` e comentário6158608289 da PR79.

WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=PR79-BOXSCORE-END-TO-END-PERSISTENCE; BRANCH_LOCAL=codex/pr79-boxscore-final-persistence; HEAD_INICIAL=137b78b6039a6cb7f34848e05f17c4b95b707f9a; STATUS=ACTIVE. SCOPE=isolar o incremento alheio137b78b e corrigir aditivamente matching/commit/placar/métricas por inscrição com regressões completas; gates e quatro pareceres independentes antes de merge. ESCOPO_NEGATIVO=sem PR77, migrations no Supabase compartilhado ou produção.

Divergência reconciliada: durante a pausa a PR79 recebeu137b78b, importação de elenco por texto e manual-scoresheet-engine (18arquivos) fora do packet6158529386. Preservação integral em `codex/preserve-roster-import-137b78b`; revert focal no branch desta unidade retira somente esse incremento da integração79, sem force-push e sem descartar seu histórico. O CI38506064053 falhou no gate/preview por formatação desse incremento; database/acessibilidade/CodeQL passaram. Não integrar conteúdo extra nem WIP documental da pausa na main. Originalworkspace e arquivos não rastreados preservados.

Estado funcional anterior676021c: fingerprint legado, resumos/URLs e replayHTTP corrigidos; gate local486Vitest PASS. Pareceres em9deb996 continuam REQUEST_CHANGES até renovação. Boxscore encontrou dois P2 ainda abertos: `register_existing_team` contorna prioridade de nome público por sigla; cadeia legacy commit/placar/upsert de métricas continua matching por equipe global e falha com A/B (BD305/BD307/BD310). Corrigir por migrations novas, preservando os wrappers de elegibilidade/submissão/autoridade e os dois formatos suportados. Não modificar migrations publicadas. SQL/upgrade somente em CI descartável; Docker local ausente.

Correção estabilizada: migration aditiva `20261014054203_boxscore_registration_bound_persistence.sql` centraliza prioridade nome público/global/sigla em helper privado, aplica a validação a todos os ramos do resolver, rejeita seleção ambígua por equipe global e mantém inscrições distintas até participantes/placar/métricas. O core redefinido é o nome final `admin_commit_boxscore_import_without_eligibility`; wrappers superiores de elegibilidade/jogo selecionado/papéis/autoridade e adaptação Site permanecem inalterados. Métricas e refresh recebem o mapa revisado de inscrição, sem inferência pela ordem home/away. Abreviação ausente só é aceita pelo resolver para o contrato Site; nunca gera matching por sigla vazia ou métrica indisponível.

Evidência focal: reprodução PostgreSQL em memória com corpos SQL reais e fixture FIBA ALC×AVA58–67 passou para A/B com LAA/LBB, LOB/LOB, métricas e rejeição BD317 da equipe errada por sigla. Schema reduzido e Auth simulado: não substitui pgTAP/Supabase integral. Gate local `npm run check` PASS,486Vitest/65arquivos, format/lint/typecheck/runbooks/agentes/build/segredos(724arquivos), sem código extra de texto/súmula no diff. Novos pgTAP:22cenários FIBA (resolver→commit→refresh/replay/rollback/autoridade) e10Site(A/B sem abreviações, cinco domínios/snapshots e indisponibilidade preservada). SQL integral/upgrade aguardam CI descartável do SHA publicado. WRITE_LOCK=RELEASED após push para quatro revisores; sem aprovação presumida e sem merge até pareceres válidos.

PR73 ainda draft emf3b1a5d baseada4264dd2, não revisada nesta execução; depois da aprovação/integração79, reconciliar e revisar banco/acessibilidade/QA. PR77 intocada. Supabase compartilhado não deve ser alterado; versões remotas históricasPR66 20261005140439/20261005140504 não devem ser reaplicadas.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=resolverSQL e cadeia efetiva de commit/refresh de boxscore; ACAO=concluir correção aditiva e testar resolução→confirmação→persistência com inscriçõesA/B, siglas iguais/próprias e seleção errada por sigla; publicar packet e renovar banco/estatísticas/boxscore/QA; CRITERIO_DE_CONCLUSAO=regressões e gates verdes, pareceres válidos sem bloqueios para integrar79 e depois73, sem PR77/DDLcompartilhado/produção.

## Unidade autoritativa — revisão independente #79 → #73

Este checkpoint substitui operacionalmente as instruções de retomada históricas abaixo, preservadas como evidência. O responsável autorizou revisar #79 e depois #73 e integrar somente com pareceres válidos e gates; proibiu alterar #77, aplicar migrations no Supabase compartilhado e publicar produção.

WORK_UNIT=PR79-LEGACY-PUBLICATION-AND-PROFILE-INTEGRITY; OWNER=project-maintainer; BRANCH_REMOTA=codex/independent-registrations-copy; BRANCH_LOCAL=codex/pr79-review-handoff; BASE_COMMIT=f29d8ba620d8d64697874a7958f53f601671a63c; HEAD_REVISADO_ANTERIOR=4264dd2937a5993f97e46870f2c109aed5fdb6a2. WRITE_LOCK=ACTIVE para correção focal dos achados independentes. Revisores somente leitura; o checkout do parecer anterior permanece congelado.

REVIEW_PACKET anterior: comentário 6157258054 da PR #79; para #73, comentário 6157258955. Banco/segurança, estatísticas e QA emitiram REQUEST_CHANGES em 4264dd2; pareceres registrados nos comentários 6158295042 e 6158337714. O checkout original permanece em dbecf54, com `app/modules/manual-scoresheet-engine/` não rastreado e preservado.

Correções focais: migration aditiva `20261014004407_legacy_publication_registration_compat.sql` aceita o fingerprint legado somente com os campos originais ainda iguais e nome da inscrição correspondente ao snapshot imutável; não recalcula hashes nem reescreve publicações. Migration aditiva `20261014004539_boxscore_registration_identity_contract.sql` alinha matching SQL por nome público/global/sigla e permite duas inscrições da mesma equipe, preservando AAL2/ownership/ledger e a rejeição de ID de inscrição repetido. Resumos do atleta usam identidade por inscrição com fallback de schema legado. URLs históricas usam a inscrição resolvida no montador. A action de cópia envia o payload validado à RPC autoritativa, que consulta replay antes das regras mutáveis; origem, MFA e CSRF continuam obrigatórios. Regressões focais cobrem perfil/histórico/jogo, URL antiga/A/B/contexto incorreto, retry/CSRF/MFA/payload inválido, upgrade publicado e matching SQL. Novo boxscore-domain-reviewer é obrigatório pelo delta semântico.

Gate local da correção: `npm run check` PASS (483 Vitest em 65 arquivos, formatação, lint com avisos preexistentes, typecheck, runbooks, agentes, build, scan de 719 arquivos); 12 regressões focais PASS; `git diff --check` PASS. Docker não disponível localmente; SQL/upgrade serão executados exclusivamente no CI descartável após push. `npm ci`/typegen regenerou tipos efêmeros de Worker; alteração gerada nesta unidade foi identificada e removida do delta, sem tocar trabalhos preexistentes. Pareceres anteriores permanecem REQUEST_CHANGES até nova revisão; PR continua draft e não integrada.

Rodada `9deb996`: CI38492615854, preview38492615976 e CodeQL38492616016 PASS; 483 Vitest, 45 arquivos/1.271 pgTAP, upgrade publicado e matching SQL aprovados. Banco/estatísticas/QA confirmaram resolução dos achados iniciais, mas mantiveram REQUEST_CHANGES por dois P2 de leitura legada: segunda consulta de inscrições do histórico sem fallback `public_name` e descarte de `registrationId` em snapshot antigo. A correção posterior adiciona fallback também quando há jogos/adversários e preserva o ID da inscrição no DTO do snapshot, sem mudar IDs/slugs históricos nem publicações armazenadas. Três regressões adicionais usam o loader e o parser reais. Gate local posterior PASS: 486 Vitest/65 arquivos, format/lint/typecheck/build/runbooks/agentes/segredos; nenhum delta SQL nesta rodada. Renovação focal dos pareceres e gates do HEAD final ainda obrigatória. WRITE_LOCK=RELEASED após publicação para revisão; nenhum merge/rollout autorizado por este checkpoint.

Evidência verificada: CI 38481648806 em 4264dd2, 45 arquivos/1.266 pgTAP e 471 Vitest; Playwright 9 aprovados/2 ignorados. Preview 38481648688 (smoke público, segurança/privacidade, 2 testes de acessibilidade/reflow) e CodeQL 38481648699 aprovados. Migrations desde zero, upgrade histórico, rejeição de consolidação divergente, concorrência e PostgREST passaram no banco descartável do CI. Reutilizar estas evidências somente se o artefato correspondente não mudar. A falta de Docker local não impede consultar o gate remoto descartável comprovado.

Supabase compartilhado: sem alterações nesta execução; migrations #68/#69/#73 continuam pendentes conforme pré-flight publicado. As duas migrations #66 possuem versões remotas históricas distintas: não reaplicar nem executar repair/db push cego. Produção é workflow manual e não será acionada. A `main` não tem branch protection configurada (API 404); isso exige conferência explícita dos gates, sem ignorar pareceres bloqueantes.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=PR #79; ACAO=executar gate da correção, publicar novo HEAD/REVIEW_PACKET e renovar banco, estatísticas, boxscore e QA; após aprovação integrar e revisar #73; CRITERIO_DE_CONCLUSAO=pareceres válidos e gates comprovados para cada integração, sem alteração de #77, Supabase compartilhado ou produção.

## Reconciliação PR #79 após merge do boxscore — 13/10/2026

WORK_UNIT=RECONCILE-PR79-AFTER-PR65; OWNER=project-maintainer; BRANCH=codex/independent-registrations-copy; STATUS=RELEASED. HEAD de PR79 reconciliado com main@f29d8ba620d8 por merge sintético com dois pais. O redirecionamento 303 e o caminho público por naipe aprovados em PR #65 foram preservados ao aplicar 9 hunks da inscrição independente nos dois arquivos administrativos afetados. UI #63 permanece preservada. A PR #79 continua DRAFT, risco CRITICO e **não autoriza merge na main** antes de CI completo, pareceres especialistas independentes e rollout seguro de migrations no Supabase compartilhado. Nenhum banco remoto nem produção alterados.


## Checkpoint de reconciliação PR #65 após merge da UI — 13/10/2026

WORK_UNIT=BOXSCORE-POST-CONFIRM-MAIN-REBASE; OWNER=project-maintainer; BRANCH=codex/boxscore-dynamic-rollout; STATUS=RELEASED após validação. Novo merge de `main@dba21a70f3a0` preserva integralmente a UI pública integrada em PR #63, reaplica os cinco arquivos funcionais originais da #65 sem conflitos de conteúdo e conserva este HANDOFF. PR continua DRAFT até gates no novo HEAD e prova do smoke AAL2 autenticado ou decisão auditável de release; nenhum deploy ou migration remota realizado.

## Checkpoint integração PR #63 — 13/10/2026

WORK_UNIT=UIUX-PUBLIC-FOUNDATION-MAIN-RECONCILE; BRANCH=codex/uiux-public-foundation; OWNER=project-maintainer; STATUS=RELEASED após o merge de reconciliação. A branch foi integrada com `main@c7438c5c1b` preservando os 24 arquivos funcionais sem sobreposição, aplicando os 16 hunks de CSS da PR ao CSS atual sem conflitos e preservando o HANDOFF da main. Nenhum código da PR #72 cancelada foi introduzido deliberadamente. Risco de UI/estatísticas públicas exige CI, acessibilidade, navegação, validação visual de responsividade e revisão de publicação/dados no commit reconciliado antes de merge. Sem produção nem Supabase compartilhado. Próximo passo: conferir runs e pendências da PR #63.

> Checkpoint operacional da linha de edições multidimensionais. Histórico detalhado e evidências anteriores permanecem no Git, nas PRs e em `docs/execution/`. Não registrar segredos.

## Checkpoint PR #75 — 09/10/2026

A unidade ativa desta sessão é `GOVERNANCE-RISK-BASED-REVIEWS-2026-10-08`, PR #75, branch remota `codex/governance-risk-based-reviews`, base `59fb0eeb7a9f99491e8b913dc9265a4f08ecb184`. Este checkpoint substitui operacionalmente a unidade antiga abaixo, preservada como histórico da pilha. Workspace PR69 e demais worktrees foram preservados.

WRITE_LOCK: OWNER=project-maintainer; WORK_UNIT=GOVERNANCE-RISK-BASED-REVIEWS-2026-10-08; BRANCH=codex/governance-risk-based-reviews; STATUS=ACTIVE; SCOPE=QA independente sob contrato v2, registro das evidências e merge autorizado da PR75 se aprovada; sem alteração da PR72, migrations compartilhadas ou deploy de produção.

Artefato normativo `9c058009d877e64efee835624c343d09cf4a9378`: CI [37867233510](https://github.com/renato-lucindo/base-do-basquete/actions/runs/37867233510), CodeQL [37867233499](https://github.com/renato-lucindo/base-do-basquete/actions/runs/37867233499) e preview [37867233560](https://github.com/renato-lucindo/base-do-basquete/actions/runs/37867233560) aprovados. CI executou gate consolidado, 457 testes Vitest, 10 Playwright e banco/pgTAP/concorrência/RPC; scan de 699 arquivos passou. Supabase Preview foi SKIPPED e não substituiu o job database aprovado. Este commit de checkpoint altera somente documentação de evidência; revisão incremental e checks finais devem ser confirmados na PR antes do merge. Parecer completo e resultado de integração serão registrados na PR, fonte remota verificável.

QA independente acionado sob o perfil operacional `.agents/qa-reviewer.md` da base v2, em instância separada; tipo customizado indisponível no runtime, sem dispensa da revisão. A v3 proposta não autoriza sua própria aprovação. PR72 mantém seu BLOCK_RELEASE estatístico até novo parecer independente; segurança e estatística críticas continuam obrigatórias. Nenhuma migration ou publicação em produção foi executada nesta unidade.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=GitHub PR75; ACAO=obter parecer QA válido no HEAD final e confirmar checks, integrar somente se aprovado, registrar merge e liberar lock na PR. Após integração, a próxima unidade será atualizar explicitamente o REVIEW_PACKET da PR72 sob v3, preservando os revisores críticos e o bloqueio estatístico; não iniciar essa unidade nesta sessão. CRITERIO_DE_CONCLUSAO=PR75 MERGED com SHA verificável, parecer válido e checks verdes, sem migrations compartilhadas ou deploy de produção.
## 1. Unidade corrente e integração

`EDITION-CREATION-PR66-MAIN-RECONCILE`: reconciliação da PR draft #66 (`codex/season-division-model`) com `main` em 08/10/2026, após a integração da governança documental pela PR #71 (merge `8ac6220`). O conflito de `HANDOFF.md` foi reconciliado com o formato compacto da governança; `docs/plan/README.md` teve merge automático.

Este merge de integração agrega a governança documental de `main`, sem mudança deliberada no comportamento funcional, migrations da PR #66 ou infraestrutura. Os commits funcionais anteriores mantêm sua validade histórica; CI e verificação do HEAD resultante são necessários antes de integrar.

```text
WRITE_LOCK:
OWNER: project-maintainer
WORK_UNIT: EDITION-CREATION-PR66-MAIN-RECONCILE
BRANCH: codex/season-division-model
BASE_COMMIT: 3d27b45b60b3f15dcf4ebe9053441efc406f773c
SCOPE: reconciliar o merge de main na PR66 e atualizar checkpoint documental
SCOPE_NEGATIVO: sem novas migrations, alteração de dados no Supabase, merge na main ou produção
REQUIRED_REVIEWERS: dispensa especializada para delta de merge/documentação sem mudança funcional, sujeita à confirmação do diff
STATUS: RELEASED
```

## 2. Sequência das PRs

- PR #66: edição/temporada/divisões; draft sobre `main`; branch `codex/season-division-model`. Commit funcional revisado `4542f44`; último HEAD anterior a este merge `3d27b45`.
- PR #68: cadastro de edição sem naipe, dependente da #66; draft sobre `codex/season-division-model`; HEAD anterior `be8cb34`.
- PR #69: inscrições independentes e cópia transacional, dependente da #68; draft sobre `codex/edition-identity-no-gender`; HEAD documental `b9c8d57` já publicado em 08/10. Artefato funcional revisado `a5c84f4`.
- PR3: criação múltipla de disputas/navegação, implementada localmente na branch `codex/multi-dispute-creation-navigation` (HEAD `f1f2112`), aguardando publicação e gates remotos, na sequência da #69.
- PR4/PR5: importação individual e em lote permanecem etapas posteriores e devem usar unidades/branches próprias.

As PRs são empilhadas e precisam ser conciliadas em ordem. Nenhuma PR desta sequência deve ser tratada como integrada à `main` sem verificação remota.

## 3. Banco e serviços

- Supabase compartilhado: as migrations funcionais da PR #66 `20261002144945_season_division_model.sql` e `20261005124828_edition_creation_workflow.sql` já foram aplicadas em 05/10/2026 com IDs remotos `20261005140439` e `20261005140504`. **Não reaplicar** por divergência de timestamp.
- Após o rollout PR66: cinco temporadas, seis competições, dez jogos, nenhuma disputa sem temporada e nenhum ledger de workflow persistido. Testes pgTAP focais 43/43 em transação revertida; AAL2 em preview verificado sem criação real de edição pela interface.
- Migrations PR1/PR2/PR3 ainda não aplicadas ao Supabase compartilhado neste checkpoint.
- Produção Cloudflare permaneceu inalterada no último checkpoint verificado da PR66. Novo deploy depende de gate apropriado.

## 4. Evidências e riscos

- PR #66, funcional `4542f44`: pareceres banco/segurança, acessibilidade e QA `APPROVE`, sem P0–P3; CI, banco/pgTAP, preview e CodeQL verdes no artefato funcional. Os cinco checks antigos também estavam verdes no HEAD `3d27b45`.
- PR #69, funcional `a5c84f4`: pareceres especializados aprovados ou aprovados com notas não bloqueantes; CI (incluindo 45 arquivos/1.264 assertivas pgTAP), preview e CodeQL verdes. No HEAD apenas documental `88d0b13`, os três workflows também estavam verdes. `b9c8d57` ainda não apresentou checks próprios na consulta de 08/10.
- O merge de `main` na PR66 altera a base da pilha: reconfirmar compatibilidade das PRs #68/#69, atualizar seus branches sem force-push e exigir seus checks para os HEADs correspondentes.
- Não declarar aprovação final de release com base apenas nos pareceres de working tree. Manter PRs draft até o gate de integração aplicável.

## 5. REVIEW_PACKET

```text
REVIEW_PACKET:
WORK_UNIT: EDITION-CREATION-PR66-MAIN-RECONCILE
BRANCH: codex/season-division-model
BASE_COMMIT: 3d27b45b60b3f15dcf4ebe9053441efc406f773c
OBJETIVO: eliminar conflito de merge com main, conservando o checkpoint documental compacto
CRITERIOS_DE_ACEITE: sem conflitos, diff funcional preservado, gates remotos do HEAD resultante aprovados, cadeia empilhada coerente
ESCOPO_NEGATIVO: sem nova migration, alteração de banco compartilhado ou deploy em produção
REQUIRED_REVIEWERS: dispensa de revisão especializada se o delta for comprovadamente apenas documental/merge; caso contrário renovar pareceres proporcionais
WRITE_LOCK_OWNER: RELEASED
```

## 6. Próximo passo exato

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: GitHub PR #66, PR #68, PR #69 e branch codex/multi-dispute-creation-navigation
ACAO: publicar o merge reconciliado da PR66; validar CI/database/preview/CodeQL; reconciliar PR68/69 em ordem e publicar a PR3 como draft; executar os gates SQL/CI, revisões e smoke necessários para cada SHA funcional
CRITERIO_DE_CONCLUSAO: PR66 sem conflito; stack PR68/69 consistente; PR3 draft com evidências remotas e pareceres vinculados ao SHA; sem perda de worktrees/untracked
```

## 7. Rastreabilidade

O histórico longo da PR66 permanece em `3d27b45:HANDOFF.md`, o checkpoint da governança em `8ac6220:HANDOFF.md`, os resultados no histórico de comentários/checks das PRs #66/#68/#69 e os pacotes encerrados em `docs/execution/`. Preserve as worktrees em andamento e os não rastreados de outros trabalhos.
