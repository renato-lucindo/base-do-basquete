# HANDOFF — Base do Basquete

> Estado persistente para continuidade entre sessões, contas e agentes Codex. Atualize fatos e evidências; não registre segredos.

## 1. Objetivo

Construir do zero e publicar a **Base do Basquete**, aplicação web de dados e histórico do basquete, com administração de campeonatos, equipes, jogadores, elencos, jogos, estatísticas, colocações, conquistas, súmula manual e importação de formatos de boxscore PDF explicitamente versionados.

## 2. Estado atual

- Unidade ativa: `PR54-RECONCILIATION-2026-09-29`, na branch `codex/admin-ux-01`, com `WRITE_LOCK` do `project-maintainer`. A PR #53 foi integrada em `main` pelo merge commit `5600f53c96e809d7cf5b9aca0519ac427e4bd540`; suas migrations estatística e Basketball Site já persistidas continuam proibidas de reaplicação. A `main` foi incorporada à branch da PR #54 sem reescrever histórico; o único conflito foi o estado narrativo deste `HANDOFF.md`, resolvido preservando os fatos atuais da `main` e o escopo ADMIN-UX-01.
- Escopo efetivo da PR #54 após a reconciliação: melhorar os fluxos administrativos da edição, incluindo isolamento das etapas da súmula, ações coerentes com fonte/estado, pré-requisitos da agenda, confirmação transacional de inscrições em lote, nomes acessíveis únicos e entrada local de data/hora convertida server-side em `America/Sao_Paulo`. A migration aditiva `20260924152000_admin_ux_01_readiness.sql` cria contratos/RPCs sem criar ou alterar tabelas; seu estado remoto deve ser verificado antes de qualquer aplicação.
- `WRITE_LOCK`: `OWNER=project-maintainer`; `WORK_UNIT=PR54-RECONCILIATION-2026-09-29`; `BRANCH=codex/admin-ux-01`; `BASE_COMMIT=5600f53c96e809d7cf5b9aca0519ac427e4bd540`; `HEAD_PRE_RECONCILIATION=2a41e7768f631d95e27079dc3b5b7022c8d5c610`; `SCOPE=reconciliar ADMIN-UX-01 com a main, validar migration/RPCs, interface administrativa e release gate`; `SCOPE_NEGATIVO=sem reaplicar migrations persistidas nem antecipar o escopo ADMIN-UX-02`; `REQUIRED_REVIEWERS=database-security-reviewer, accessibility-ui-reviewer, qa-reviewer`; `STATUS=RECONCILING`.

- Unidade ativa: `PR53-RECONCILIATION-2026-09-28`, na branch `codex/stats-player-statistics`, reconciliando a PR #53 com `origin/main@94f738d`. A PR #52 foi encerrada por decisão do responsável em 25/09/2026, sem merge.
- A migration STATS `20260922141453_stats_public_player_snapshot.sql` já foi aplicada anteriormente ao Supabase compartilhado, com autorização explícita, como `20260922161633_stats_public_player_snapshot`; não reaplicar. A migration Basketball Site que bloqueava o QA foi reconciliada durante a recuperação da PR #57 como `20260925180553_basketball_site_boxscore`; esse bloqueio deixou de existir.
- Evidência anterior da PR #53 no HEAD `65936ff`: gate, database, accessibility, preview e CodeQL passaram; localmente `npm run check` aprovou 51 arquivos/373 Vitest, typecheck, build, 5 runbooks e scan de 637 arquivos, e Playwright+axe passou 1/1 em Chromium. Essa evidência precisa ser renovada porque a reconciliação com a `main` atual altera dependências, workflow e HEAD.
- Reconciliação atual: merge de `origin/main@94f738d` resolvido no commit `3c946f7`, preservando Playwright/fast-check e as versões novas de dependências; workflow retomável registrado em `docs/execution/PR-CONSOLIDATION-WORKFLOW.json`. Gate local aprovado com formatação, lint sem erros (237 avisos históricos), typecheck, 51 arquivos/373 Vitest, 5 runbooks, 7/7 agentes e skills com 42 cenários, build e scan de 669 arquivos. Playwright/axe passou 1/1 em Chromium. No mesmo HEAD, `gate`, `database`, `accessibility`, preview/upload e CodeQL passaram; a PR está mergeável.
- `REVIEW_PACKET` publicado na PR #53 no comentário `5877216430`. Na retomada sequencial, `database-security-reviewer` emitiu `APPROVE_WITH_NON_BLOCKING_NOTES` para `094016d` no comentário `5882612146`; não encontrou P0/P1 e manteve como P2 conhecido a ausência de classificação de fase no histórico do perfil. A primeira tentativa de `statistics-domain-reviewer` foi descartada sem publicação por conter premissa factual contraditória sobre `game.status='final'` e ignorar a cadeia RLS da publicação corrente. Uma nova instância focal confirmou `games_public_select -> game_is_currently_published`, a autoridade ativa e o snapshot imutável, emitindo `APPROVE_WITH_NON_BLOCKING_NOTES` no comentário `5882669876`. Nenhum revisor alterou arquivos ou serviços.
- Retomada de 29/09: `accessibility-ui-reviewer` publicou `APPROVE_WITH_NON_BLOCKING_NOTES` no HEAD `a27246d` (comentário `5889435937`). O `qa-reviewer` validou incrementalmente os pareceres de banco e estatística, mas publicou `BLOCK_RELEASE` (comentário `5889517344`) por falta de evidência de reflow a 200% e pela comparação depender de cor. O parecer de acessibilidade expirou para o delta corretivo; banco e estatística não foram afetados.
- Remediação concluída no HEAD funcional `6f9e98e`: cada célula comparada anuncia `Melhor valor` ou `Pior valor`; o teste unitário passou 9/9. O preview `36563939986` publicou o alias e aprovou “Verify public statistics accessibility and 200 percent reflow”; `gate`, `database`, `accessibility`, preview/upload e CodeQL estão verdes no mesmo HEAD, e a PR está `MERGEABLE/CLEAN`.
- Revisão final: `accessibility-ui-reviewer=APPROVE_WITH_NON_BLOCKING_NOTES` no comentário `5889734155`; `qa-reviewer=APPROVE_WITH_NON_BLOCKING_NOTES` e `running-release-gate=READY` no comentário `5889811708`. Banco (`5882612146`) e estatística (`5882669876`) permanecem válidos incrementalmente porque os deltas posteriores não alteraram esses domínios. O `BLOCK_RELEASE` `5889517344` está resolvido.
- `WRITE_LOCK`: `OWNER=project-maintainer`; `WORK_UNIT=PR53-RECONCILIATION-2026-09-28`; `BRANCH=codex/stats-player-statistics`; `BASE_COMMIT=94f738d`; `HEAD_PRE_RECONCILIATION=65936ff`; `SCOPE=reconciliar a PR #53 com a main atual, corrigir o handoff, preservar as migrations já aplicadas, renovar gates, preview, review packet e pareceres proporcionais`; `SCOPE_NEGATIVO=sem reaplicar migrations persistidas, sem alterar fórmulas ou contratos fora do delta existente, sem merge, migration compartilhada ou produção antes dos gates e autorizações`; `REQUIRED_REVIEWERS=database-security-reviewer, statistics-domain-reviewer, accessibility-ui-reviewer, qa-reviewer`; `STATUS=READY_FOR_FINAL_MERGE_AUTHORIZATION`.

- Fase: plano acelerado concluído; MVP-01 a MVP-05 e POST-01 a POST-04 estão `DONE`. A baseline de acessibilidade foi integrada na `main` pela PR #50, a consolidação restante pela PR #51 e a fundação de governança documental pela PR #56.
- Status geral: `PR53_RECONCILIATION_IN_PROGRESS`; `origin/main` está em `94f738d` após a integração da fundação de agentes pela PR #61 e a atualização de dependências pela PR #62. A aplicação de produção continua saudável no código funcional `3ae5334` após a PR #57 e a reconciliação de schema; não houve novo deploy associado às PRs documentais ou de agentes.
- Linha anterior preservada: WP-00 a WP-14 concluídos e publicados; WP-15 a WP-20 prontos para revisão; WP-22 consolidou o contrato UI/UX; WP-23 implementou os fluxos administrativos que formam a base da PR #35.
- Repositório GitHub: privado em `renato-lucindo/base-do-basquete`.
- As unidades das PRs #58/#59 e `AGENT-SKILLS-FOUNDATION` foram encerradas e integradas. Sete subagents read-only e sete skills locais estão disponíveis; `project-maintainer` permanece o único escritor.
- PR documental #58 (`docs: registrar recuperação da release da PR #57`) integrada por squash em `5e24e90`. O HEAD final `3485456` passou `gate`, `database`, preview/smokes e CodeQL antes do merge; na `main@5e24e90`, CI `36187665468` e CodeQL `36187665458` também passaram. Revisores especializados foram dispensados por ser alteração exclusivamente documental, sem mudança de comportamento, segurança, governança ou release.
- `WRITE_LOCK`: `OWNER=project-maintainer`; `WORK_UNIT=RECORD-PR57-RELEASE-RECOVERY`; `BRANCH_FINAL=codex/close-pr58-handoff`; `BASE_COMMIT=3ae5334`; `HEAD_COMMIT_PR58=3485456`; `MERGE_COMMIT_PR58=5e24e90`; `SCOPE=registrar o fechamento e a recuperação da release da PR #57, integrar a PR documental #58 e reconciliar o HANDOFF após o merge; sem código, migration, Supabase ou produção`; `STATUS=RELEASED` após integração deste closeout documental, com CI e CodeQL pós-merge verdes.
- Unidade `FIX-BOXSCORE-GEOMETRIC-COLUMNS` concluída funcionalmente no commit `9b3268b`: o parser FIBA/Genius deixou de estimar posição por largura média de caractere e passou a distribuir tokens por sobreposição com slots geométricos explícitos, preservando também slots percentuais apenas para alinhamento. Testes cobrem 2/3/4 células fundidas, valores negativos, percentuais fundidos, geometria incompatível e as quatro fixtures suportadas, incluindo o Basketball Site de duas páginas como regressão. Gate local consolidado verde: formatação, lint sem erros (146 avisos históricos), TypeScript, 45 arquivos/330 Vitest, 5 runbooks, build e scan de segredos em 616 arquivos. No mesmo HEAD funcional, CI `36142091757` passou em `gate` e `database`, preview `36142091703` passou e CodeQL `36142091739` passou; a PR está `CLEAN`.
- Unidade `FIX-BOXSCORE-PDF-BUFFER` concluída funcionalmente no commit `c8e568a`: `extractSupportedBoxscore()` agora entrega ao PDF.js uma cópia do `Uint8Array`, preservando o buffer original para o upload privado posterior. A regressão com a fixture SAL × SAN confirma que o `byteLength` do chamador permanece intacto e que `createPdfStorageBody()` conserva o tamanho original. Validação real em `workerd` confirmou `106213 -> 106213`, Blob de `106213` bytes e jogo `5205816`. Gate local consolidado verde: formatação, lint sem erros (146 avisos históricos), TypeScript, 45 arquivos/331 Vitest, 5 runbooks, build e scan de segredos em 616 arquivos. No HEAD funcional `c8e568a`, `gate`, `database`, preview/upload e CodeQL remotos passaram.
- `WRITE_LOCK`: `OWNER=project-maintainer`; `WORK_UNIT=FIX-BOXSCORE-PDF-BUFFER`; `BRANCH=codex/fix-boxscore-sal-san`; `BASE_COMMIT=c9bf230`; `HEAD_COMMIT_FUNCIONAL=c8e568a`; `SCOPE=preservar os bytes do PDF durante a extração, teste de regressão e evidências da PR #57; sem alteração de parser esportivo, OCR, visão computacional, migration, Supabase compartilhado, merge ou produção`; `STATUS=RELEASED` após gate local, validação funcional no workerd e quatro checks remotos verdes.
- `WRITE_LOCK`: `OWNER=project-maintainer`; `WORK_UNIT=BOXSCORE-TEAM-RESOLUTION`; `BRANCH=codex/fix-boxscore-sal-san`; `BASE_COMMIT=83f3266`; `HEAD_COMMIT_FUNCIONAL=3208ceb`; `SCOPE=permitir revisão explícita de equipe ausente no boxscore, reutilização de equipe existente, criação atômica de equipe + inscrição confirmada, integração com o review e testes; manter jogo/confronto estrutural fora do importador; sem OCR, parser genérico, merge ou produção`; `STATUS=RELEASED` após gate local com 333 Vitest, build e scan, CI `36161190882` com `gate` e banco desde zero/pgTAP/concorrência verdes, preview `36161191237` e CodeQL `36161190850` verdes.
- `WRITE_LOCK`: `OWNER=project-maintainer`; `WORK_UNIT=BOXSCORE-TEAM-RESOLUTION-HARDENING`; `BRANCH=codex/fix-boxscore-sal-san`; `BASE_COMMIT=7d3496f`; `HEAD_COMMIT_FUNCIONAL=1b11afb`; `SCOPE=corrigir os achados do database-security-reviewer na resolução de equipes: estado autoritativo protegido, idempotência vinculada ao payload e concorrência específica da RPC; sem merge, migration compartilhada ou produção`; `STATUS=RELEASED` após gate local com 333 Vitest, build e scan, CI `36163865757` com migration desde zero, 40 arquivos/999 pgTAP e concorrência divergente da nova RPC verdes, preview `36163865753` e CodeQL `36163865777` verdes.
- `WRITE_LOCK`: `OWNER=project-maintainer`; `WORK_UNIT=BOXSCORE-TEAM-RESOLUTION-ROLLOUT`; `BRANCH=codex/fix-boxscore-sal-san`; `HEAD_COMMIT_FINAL=ab3dc50`; `MERGE_COMMIT=3ae5334`; `SCOPE=aplicar a migration 20260925160711 ao Supabase compartilhado, validar pgTAP/advisors/grants/policies e smoke AAL2, integrar/publicar pelo fluxo protegido e, após autorização explícita adicional, reconciliar a migration Basketball Site ausente que bloqueava a release`; `STATUS=RELEASED` após integração da PR #57, correção do drift de schema e workflow de produção verde.
- Revisão final da unidade no HEAD `457e000`: `database-security-reviewer=APPROVE` (PR #57 comentário `5836341366`), confirmando resolvidos os três achados anteriores; `qa-reviewer=APPROVE_WITH_NON_BLOCKING_NOTES` (comentário `5836388805`), sem P0/P1/P2 e somente nota P3 pela ausência de teste React específico da interação da nova UI. As revisões incrementais documentais no HEAD `bd272b6` também aprovaram o delta (`5836418692` e `5836440382`). CI `36165495133`, preview `36165495083` e CodeQL `36165495137` estão verdes.
- Rollout autorizado em 25/09/2026: a migration `20260925160711_boxscore_team_resolution.sql` foi aplicada ao Supabase compartilhado como `20260925173548_boxscore_team_resolution`. O pgTAP persistente passou 31/31 em transação revertida; grants/policies foram reconciliados com RLS habilitada e forçada, `authenticated` somente com `SELECT` na tabela autoritativa e `anon` sem `EXECUTE` nas RPCs. Advisors não apontaram novo bloqueio de segurança; o advisor de performance registrou quatro FKs sem índice na nova tabela como `INFO`, sem impacto bloqueante na cardinalidade atual de uma resolução por importação.
- Smoke AAL2 real no preview da PR #57, importação `24`: IVV reutilizou a inscrição `46`; `Saldanha da Gama` foi criada privada como equipe `139` e recebeu a inscrição confirmada `189`. Houve exatamente uma resolução autoritativa e uma auditoria. As contagens estruturais da competição `20` permaneceram `games=2`, `matchups=2`, `competition_entry_assignments=0`, confirmando que a resolução não cria jogo/confronto. O conflito divergente `BD318` passou no pgTAP persistente e o teste focal da rota confirmou o mapeamento HTTP 409 (5/5); o adaptador SQL do conector não preservou o SQLSTATE customizado em uma tentativa direta e essa tentativa não foi usada como evidência.
- Integração e incidente de release em 25/09/2026: a PR #57 foi squash-merged em `3ae5334`; CI `36169535448` e CodeQL `36169535570` passaram. O primeiro workflow de produção `36170076407` publicou o Worker, mas falhou no benchmark porque `/2026/copa-es-ouro/fixture-fiba/masculino/jogos/63` retornou HTTP 500. A causa foi drift de schema: a `main` já dependia de `game_period_scores.score_scope`, introduzido pela PR #51 em `20260917173556_basketball_site_boxscore.sql`, mas essa migration não existia no histórico compartilhado do Supabase.
- Reconciliação autorizada em 25/09/2026: o preflight confirmou ausentes as três colunas, triggers e helpers exclusivos da migration Basketball Site; a migration versionada foi aplicada como `20260925180553_basketball_site_boxscore`. O pgTAP persistente `basketball_site_boxscore.test.sql` passou 35/35 em transação revertida. Advisors não apontaram novo bloqueio ligado à correção; permanecem avisos preexistentes de RPCs administrativas `SECURITY DEFINER`, proteção de senha vazada desabilitada e recomendações de performance.
- Release recuperada: o workflow protegido `36171540445` em `main`/`3ae5334` passou `npm run check`, deploy, smoke de health/cabeçalhos/admin, smoke de contexto público, smoke MVP de segurança/privacidade e benchmark. A versão Cloudflare atual é `4a89109e-1b78-4f13-aa57-b45764f40338` em `https://base-do-basquete-prod.renato-lucindo-jr.workers.dev`. O jogo FIBA 63 voltou a responder no benchmark com payload de 36.658 bytes. O benchmark é informativo e registrou p95 acima dos alvos impressos: 3.938,5 ms em estatísticas avançadas e 2.066,8 ms no jogo 63; tratar performance em unidade separada sem reabrir o incidente funcional.
- Evidência final do WP-13 integrada em `main`: `2e7e530` (`WP-13 — Concluir release de produção (#22)`).
- Aplicação publicada: commit `3ae5334` saudável em `https://base-do-basquete-prod.renato-lucindo-jr.workers.dev`; versão Cloudflare `4a89109e-1b78-4f13-aa57-b45764f40338`; workflow protegido `36171540445` verde. A tag `v1.2.0` permanece como release anterior/rollback conhecido no commit `bd248f9`.
- Smoke AAL2 final da release: sessão real confirmou “Sessão AAL2” e acesso protegido a `/admin/competitions` em produção, sem mutação de domínio.
- Cloudflare: workflow protegido `35225504568` integralmente verde; health, cabeçalhos, entrada administrativa anônima, smoke contextual, smoke de segurança/privacidade do MVP, benchmark e limpeza do arquivo efêmero aprovados.
- Supabase: projeto `base-do-basquete` na organização `renato-lucindo`, região `sa-east-1`, custo informado de US$ 0/mês e estado saudável; migrations MVP-01 de estrutura, ingestão em jogo existente e enforcement aplicadas transacionalmente em 09/09/2026.
- Domínio próprio: não definido e fora do escopo atual.
- Administradores na primeira temporada: uma única conta.

## 3. Decisões consolidadas

- Nome público: **Base do Basquete**.
- Reconstrução greenfield; não procurar nem depender do repositório antigo.
- GitHub é a fonte da verdade; infraestrutura e artefatos importantes não podem existir apenas localmente.
- Desenvolvimento ocorre em branch própria por WP; WIP pode ser enviado somente para essa branch, merge exige gate aprovado e produção parte apenas da branch principal protegida ou de versão marcada.
- Cloudflare Workers hospeda preview e produção.
- Supabase fornece PostgreSQL, Auth e Storage.
- Arquitetura inicial: monólito modular full-stack em TypeScript estrito.
- Frontend é não confiável; regras e escritas são autoritativas no backend/banco.
- Primeira temporada com um único administrador, MFA e `aal2`.
- Multiadmin, convites, RBAC e gestão de usuários ficam para fase futura.
- Importação restrita aos modelos documentados FIBA/Genius Sports e Basketball Site, usando os PDFs fornecidos como fixtures.
- O parser FIBA/Genius v2 persiste também os indicadores coletivos do rodapé; os PDFs privados confirmados são a fonte do retroprocessamento idempotente.
- Similaridade de nomes é somente apoio à decisão: alternativas nunca são pré-selecionadas. Vincular atleta existente ou criar um novo ocorre na mesma transação do jogo, com duplicidade normalizada recusada no banco.
- OCR open source é alternativa futura e não deve ser pesquisado ou implementado agora.
- Domínio será decidido posteriormente; usar URLs temporárias das plataformas.

## 4. Concluído

- [x] Plano greenfield condensado em pacotes verticais.
- [x] Arquitetura cloud-first definida.
- [x] Regras de autonomia e segurança definidas.
- [x] Nome **Base do Basquete** definido.
- [x] Escopo de administrador único definido.
- [x] Formatos explícitos e versionados de boxscore definidos.
- [x] PDFs de referência incorporados ao plano como fixtures obrigatórias.
- [x] OCR registrado apenas como possibilidade futura.
- [x] Repositório remoto privado criado e baseline publicada.
- [x] Repositório Git local inicializado em branch própria do WP-00.
- [x] Plano importado e ordem de leitura obrigatória concluída.
- [x] ADRs iniciais, política de segurança, `.gitignore` e baseline de varredura de segredos criados.
- [x] Aplicação implementada integralmente; WP-00 a WP-13 concluídos e produção validada.
- [x] Serviços cloud básicos configurados.
- [x] Manual funcional do painel administrativo documentado em `docs/PAINEL-ADMINISTRATIVO.md` e referenciado pelo README.
- [x] Baseline permanente de acessibilidade documentada; Sienna 2.2.333 integrado sem execução no SSR, com recursos locais, falha isolada e testes de inicialização única/navegação.
- [x] PR #51 consolidou as PRs #4, #6, #7, #38, #48 e #49; as originais foram encerradas como substituídas.
- [x] Contrato Basketball Site compatibilizado com publicações legadas, matching restrito e rótulo genérico `Boxscore PDF`; `fiba_boxscore` permanece somente como identificador interno legado.
- [x] Gate local com 45 arquivos/324 Vitest, typecheck, build, cinco runbooks e scan de 604 arquivos aprovado; banco desde zero/pgTAP, preview com smokes, CodeQL e CI da PR #51 verdes no head funcional `1a013fc`.
- [x] Pareceres `database-security-reviewer` e `qa-reviewer` aprovados para `1a013fc`; 146 avisos de lint sem erro permanecem como débito não bloqueante separado.
- [x] Scaffold React Router full-stack em Cloudflare Workers.
- [x] CI, preview por PR, Dependabot e CodeQL com SARIF configurados.
- [x] Fluxo server-side de login, matrícula/desafio TOTP e logout implementado.
- [x] Migration de administrador singleton, RLS `aal2` e auditoria aplicada/validada.
- [x] Conta administrativa real criada e registrada no singleton controlado pelo banco.
- [x] MFA TOTP matriculado e sessão real comprovada em `aal2`.
- [x] Modelo canônico de campeonatos, edições, equipes, atletas, inscrições, elencos, jogos, períodos e colocações aplicado no Supabase.
- [x] Placar e conquistas modelados como visões derivadas, sem estado duplicado gravável.
- [x] Importação limitada aos contratos de boxscore versionados com hash SHA-256 único e bucket PDF privado.
- [x] RLS pública somente para dados publicados; escritas autenticadas exigem administrador singleton em `aal2` e `DELETE` não é concedido.
- [x] Seed de staging não público, tipos TypeScript gerados e 34 testes SQL aprovados no banco remoto.

## 5. Fechamento do WP-13

WP-13 está na branch própria. Advisors não apontam vulnerabilidade de schema acionável; a reconciliação confirmou singleton/MFA, RLS integral e ausência de órfãos. O environment GitHub `production` recebeu três bindings próprios sem exposição. O workflow agora exige secrets declarados, envia code/secrets atomicamente, executa smoke/benchmark e permite upload de candidata para rollout gradual. Gate local inicial passou com 43 testes.

O primeiro dispatch foi recusado com HTTP 422 antes de executar qualquer job ou deploy: o GitHub marcou o workflow inválido porque o comando inline de limpeza continha `: ` em um scalar YAML. A correção foi integrada pela PR #19 e a tag imutável `v1.0.1` aponta para esse commit; `v1.0.0` foi preservada como candidata não implantada.

O primeiro job válido, execução #32736328449, passou build e deploy, mas o smoke bloqueou a liberação: o Cloudflare Vite Plugin gerou uma configuração redirecionada com o ambiente top-level de preview, apesar de `wrangler deploy --env production`. Assim, nenhum Worker de produção foi criado; o Worker fixo de preview recebeu a versão nova e uma nova `SESSION_SECRET`, sem exposição de valores. A PR #20 integrou a correção que seleciona `CLOUDFLARE_ENV` antes do build, valida nome/`APP_ENV` no artefato e restaura preview/secrets atomicamente.

A execução #32737628228 restaurou o preview e `/health` confirmou `environment=preview`. O primeiro deploy de produção correto recebeu 404 durante a propagação do novo hostname; a PR #21 integrou retry limitado para 404/502/503/504. A release `v1.0.3` passou integralmente no workflow #32738728739. A candidata foi exercitada em 10%/90%, passou 50/50 health requests e smokes, foi promovida a 100% e manteve a versão anterior recuperável. O benchmark pós-promoção ficou em p95 263,6 ms para jogadores e 337,0 ms para jogo FIBA. Observability confirmou 0 erros e log customizado somente com a allowlist operacional.

O smoke administrativo final confirmou sessão `aal2`, dashboard, hub protegido, logout e redirecionamento anônimo. A auditoria registrou `mfa_verified`, `admin_access` e `logout`. Após o logout, o gerenciador do navegador preencheu automaticamente a senha e ela apareceu na saída técnica da inspeção; a sessão já estava encerrada e nenhum valor foi persistido no repositório ou nos serviços. A rotação foi recomendada, mas o responsável recusou conscientemente a alteração e aceitou o risco residual. Essa decisão não reduz MFA, `aal2`, RLS, sessão segura ou autorização server-side.

## 6. Próximo passo exato

**Estado vigente em 14/09:** MVP-01 a MVP-05 `DONE`. A candidata `cc9cece2-e4e9-49c2-a444-c04cfb154ca0` foi preservada sem tráfego; a release final saiu da `main` `f8dcb87` pelo workflow verde `34845342461`, versão Cloudflare `f3505b09-a831-4e0a-a2a7-5f0960b17d7b`, tag `v1.1.0`. Os smokes de saúde, segurança, navegação, privacidade e dados públicos passaram. Não reverter banco nem republicar migrations já aplicadas.

**Próximo passo atual:** concluir o merge de `origin/main@5600f53` na branch `codex/admin-ux-01`, executar testes focais de agenda, hub da edição, súmula e RPCs, verificar no Supabase compartilhado se `20260924152000_admin_ux_01_readiness.sql` já foi persistida e então executar o gate local consolidado. Com o HEAD funcional estabilizado, enviar a branch, aguardar CI/preview/CodeQL e obter pareceres sequenciais de `database-security-reviewer`, `accessibility-ui-reviewer` e `qa-reviewer` antes do merge da PR #54.

**Evidência AAL2 do POST-02:** sessão real confirmou AAL2; a fixture privada 100 gerou o draft 187, clonou 5 vagas e 4 confrontos sem equipes/jogos/resultados/publicação e passou duas edições CAS com restauração do nome original (`editor_revision=3`). A inscrição 15 exibiu retirada com preservação de histórico, sem executar a ação. Reconciliação: 5 edições, 9 jogos, 12 inscrições, 6 revisões, 1 draft, 1 clone request, 2 edit requests, zero vagas órfãs e zero origens indefinidas. `/health` respondeu 200; acesso anônimo ao admin respondeu 302 para login com cabeçalhos seguros. Gate local: 290 Vitest, build e scan de 563 arquivos. As quatro tabelas auxiliares legadas no schema `private` com RLS desligada não concedem nenhum privilégio de tabela a `anon`/`authenticated` e `anon` não possui `USAGE` no schema; hardening de defesa em profundidade fica no POST-04, sem exposição atual.

**Estado vigente em 11/09:** MVP-04 `DOING`. Agenda privada em `48001d9` e índices em `6d2738a` passaram os quatro checks; migrations remotas `20260911173435_mvp04_private_scheduling` e `20260911174551_mvp04_fk_covering_indexes`. O advisor não aponta FKs sem índice; avisos SECURITY DEFINER são os endpoints AAL2 intencionais. Banco preserva nove jogos, cinco revisões, fixture 100 privada, zero atribuições e zero preparações. Nova unidade local: `20260911174947_mvp04_knockout_progression.sql`, resolução imutável pelo resultado oficial principal ativo, propagação de vencedores e confirmação na rota de agenda. Ensaio remoto em rollback 28/28; gate local 245 Vitest, build e scan de 521 arquivos. Ainda sem commit/push/aplicação dessa migration. Próximo: enviar com staging exato, esperar CI, aplicar/regenerar tipos e validar preview; depois publicação versionada. Ver `docs/execution/MVP-04.md`. Sem merge ou produção.

**Retomada 11/09 — MVP-04 em implementação local:** branch limpa de partida `0612276`, PR aberta/draft, quatro checks verdes e preview `ok`; Supabase reconciliado com nove jogos, cinco revisões e fixture 100 privada. Foram criados, ainda sem commit e sem aplicação, `20260911031428_mvp04_private_scheduling.sql`, `mvp04_private_scheduling.test.sql` (29 asserções previstas), `app/modules/competition/scheduling.ts` e seu teste. A unidade separa atribuições explícitas imutáveis do blueprint, deriva participantes, prepara vagas pendentes sem jogo fictício e agenda jogos privados com CAS/auditoria. Progressão e publicação ainda NÃO implementadas. Não tratar SQL como validado.

**Bloqueio de verificação nesta retomada:** o conector Supabase deixou de estar disponível; host sem Docker/psql. Vitest e scan de segredos falharam ao iniciar subprocessos (`EPERM`); escalonamento não permitido pelo perfil atual. Biome dos dois módulos e cinco asserções diretas de domínio passaram; isso não substitui o gate. Nenhum push, migration persistente, merge ou produção realizado. Próximo: restaurar o acesso Supabase e a execução normal de testes/scan, ensaiar SQL e pgTAP em rollback, corrigir regressões e então integrar a UI, progressão e publicação. Os quatro arquivos novos precisam ser preservados nesta máquina até commit/push seguro. Não reaplicar MVP-03.

**Próximo passo vigente — MVP-04:** ler `docs/plan/acelerado-mvp/pacotes/MVP-04-OPERACAO-E-PUBLICACAO.md` e os cartões 07G, parte básica de 07H, 08A–08D. Implementar resolução autoritativa das entradas para inscrições sem mutar o blueprint ativo, preparação/agendamento de partidas dentro do confronto, progressão pelo resultado principal confirmado e publicação explícita versionada. Usar migration aditiva, preservar colunas e dados legados, testar AAL2/RLS/idempotência e fluxo eliminatório ponta a ponta. A fixture privada 100 pode apoiar QA; não apagá-la ou publicá-la sem necessidade autorizada. Não reaplicar migrations do MVP-03 nem repetir seus gates concluídos.

**Fechamento confirmado:** `4573827` passou CI/database `34536801150` (incluindo duas conexões concorrentes: criação inicial única e rejeição do terceiro confronto de semifinal), preview `34536801097` e CodeQL `34536801112`. Foco atualizado verificado por Enter no preview: FIELDSET “Dados e formato”. Viewports 390/768/1440 px verificados e restaurados. Nove jogos, quatro revisões legadas, dois perfis e quatro edições publicadas preservados. Evidências em `docs/execution/MVP-03.md`. Os parágrafos abaixo são histórico e não substituem este próximo passo.

**Estado reconciliado após aplicação:** `550ea9c` passou CI/database `34507772096`, preview `34507772091` e CodeQL `34507772119`. Migrations aplicadas no Supabase como `20260910172559_mvp03_preset_compiler` e `20260910172608_mvp03_relational_presets`; não reaplicar nem alterar seus arquivos enviados. Criação real pelo wizard gerou a edição 100, “Validação MVP-03 — não publicar”, Copa ES Ouro / Fixture FIBA / Masculino / 2027. Ela permanece `draft`, `published_at=null`, com uma auditoria de criação. Consulta sob `anon` retornou zero linhas. Não apagar essa fixture nem publicá-la.

**Próximo passo atual:** concluir QA desktop/teclado do wizard, restaurar qualquer override de viewport e testar concorrência em conexões independentes. O fluxo foi observado em 390 e 768 px sem overflow global, incluindo foco automático na revisão; não declarar gate responsivo integral. A tentativa de desktop foi interrompida por limite de uso na revisão automática do navegador, antes de confirmar o resultado; não contornar a restrição. Os tipos completos do banco foram regenerados e passaram `tsc -b`. Advisors: nova RPC SECURITY DEFINER é intencional, com singleton AAL2, grants limitados e testes de negação; ledger privado sem policies é intencional (nenhum grant). Permanecem avisos antigos de proteção de senhas vazadas e seis FKs de MVP-01 sem índices compostos, sem novo FK descoberto na estrutura dos presets. Confirmar esses residuais no gate de fechamento e manter produção sem deploy.

Atualização de fechamento: após a retomada, desktop 1440 px foi observado sem overflow global e o viewport foi restaurado. Enter avança entre etapas; ajuste de foco das etapas 1/2 incluído. `scripts/test-preset-concurrency.mjs` roda exclusivamente no Docker descartável da CI e usa barreira verificável para duas conexões concorrentes, testando idempotência na primeira criação e disputa pelo último lugar de semifinal. Gate local novamente aprovado com 216 Vitest e scan de 511 arquivos. **Próximo passo imediato:** conferir esse novo job de concorrência na CI e validar o foco atualizado no preview; então fechar MVP-03 e passar ao MVP-04. Não há Docker neste host e o teste simultâneo não foi executado no Supabase compartilhado.

Histórico das etapas de implementação abaixo; o estado aplicado acima prevalece:

Unidade integrada em 10/09/2026: persistência relacional e RPC `admin_create_competition_from_preset` implementadas na migration nova `20260910125312_mvp03_relational_presets.sql`; wizard em `app/routes/admin.competitions.new.tsx` com link “Criar edição”. Gate local: 216 Vitest, tipos/lint/build/scan (510 arquivos); 35 pgTAP em rollback, incluindo todas as 30 configurações materializadas. O baseline compartilhado segue sem migrations novas aplicadas. Próximo: conferir o ciclo CI/preview desta unidade, aplicar as duas migrations após verde, gerar/reconciliar tipos, executar advisors e QA autenticado do wizard em 390/768/desktop. Concorrência simultânea em conexões independentes e gate responsivo completo ainda pendentes; não marcar MVP-03 como concluído sem esses resultados. A assinatura da nova RPC foi incorporada aos tipos existentes para o build; regeneração integral aguarda schema aplicado.

Retomada autenticada de 10/09/2026: usuário concluiu MFA; navegação Competições/Equipes/Atletas/Segurança e accordion validados no preview, sem submissão de formulários nem logout. `app/modules/competition/ruleset-presets.ts` e `private.compile_competition_preset_v1` geram grupo único/eliminatória simples determinísticos, v1 com 2..16 entradas explícitas. Folgas não geram confrontos/partidas. Não inferir a atribuição das posições de entrada pelos nomes das equipes. Gate local completo: 31 arquivos/177 Vitest, builds e scan de 504 arquivos. SQL ensaiado com rollback: 18/18; paridade TypeScript/SQL 30/30; banco preservado com 9 jogos e 4 revisões.

**Próxima implementação:** criar nova migration aditiva que materialize a saída de `private.compile_competition_preset_v1` em trilhas/grupos/vagas com FKs contextuais, expandindo `matchups` para origens ainda não resolvidas sem remover colunas legadas. Implementar a RPC AAL2 de criação privada idempotente com perfil/período/revisão, validação e ativação atômicas; testar rollback, RLS e concorrência. Depois integrar o wizard em rota própria e concluir QA 390/768/desktop. O compilador não é endpoint nem persistência: não gravar seu JSON como referências polimórficas e não aceitar grafo arbitrário do frontend. A migration `20260910123720_mvp03_preset_compiler.sql` foi apenas ensaiada e deverá ser aplicada junto da unidade integrada após CI remoto verde. Não repetir o compilador nem o MVP-02.

Histórico da retomada anterior (bloqueio de login já resolvido):

Gate remoto da segunda unidade em 10/09/2026: `bc60d76` passou CI/database `34473818965`, preview `34473818938` e CodeQL `34473818894`. Supabase consultado via conector: `game_active_data_sources` existe, 4 revisões e 9 jogos. Ao abrir `/admin/competitions` no preview, o navegador redirecionou para `/admin/login`; não inspecionar os campos preenchidos nem copiar credenciais. Com login/MFA renovado, validar áreas/accordion em 390/768/desktop. Enquanto isso, é possível implementar presets e testes sem depender dessa sessão. A estrutura atual exige inscrições concretas em `matchups`; expandir aditivamente com vagas tipadas antes de criar confrontos futuros, preservando as migrations existentes.

Retomada de 10/09/2026: accordion e áreas Competições/Equipes/Atletas/Segurança implementados, conforme `docs/execution/MVP-03.md`. A segunda unidade separou loaders/actions e passou gate local com 117 Vitest. O head inicial `7c7b121` estava limpo e com os quatro checks verdes. Próximo: validar áreas/accordion no preview e implementar presets/compilação/wizard sobre a estrutura do MVP-01. Reconciliar Supabase antes do schema. MVP-03 continua `DOING`; não repetir MVP-02.

Reconciliar branch/PR e executar `MVP-03 — Administração e criação por presets`, usando `docs/plan/acelerado-mvp/README.md` como fila operacional. Ler `pacotes/MVP-03-ADMIN-E-PRESETS.md` e os cartões `06A`, `06B`, `07A`, `07B`, `07C`, `07D`, `06E` e `06F` somente como requisitos detalhados. Entregar navegação administrativa, presets imutáveis, compilação/ativação atômica e criação privada transacional; não antecipar editor genérico, remoção ou clonagem de `POST-02`.

Estado reconciliado em 01/09/2026: branch `feature/admin-workflow-improvements`, PR #35 aberta e draft no head funcional `e60216c`. `gate`, `database`, preview e CodeQL concluíram com sucesso. O Supabase compartilhado contém `roster_eligibility_enforcement` na versão remota `20260902013629`; `admin_replace_roster` exige singleton AAL2, nega `anon` e retorna somente decisões estáveis. As 44 linhas privadas seguem pendentes, sem inferência ou backfill; o banco mantém 48 inscrições de elenco, 48 ativas e 19 auditorias, exatamente como antes dos smokes. A coluna `public.players.birth_date` foi preservada por decisão do responsável, zerada e protegida por `CHECK (birth_date IS NULL)`; a data completa pertence exclusivamente a `private.player_private`.

Reconciliação inicial de 02/09/2026: branch limpa no head `bb8cdc3`; PR #35 aberta/draft com `gate`, `database`, preview e CodeQL verdes; `/health` do preview respondeu `preview/ok`. O Supabase compartilhado mantém migrations até `20260902013629_roster_eligibility_enforcement`, 44/44 perfis privados pendentes, 48/48 elencos ativos e 19 auditorias. O changelog atual não trouxe quebra aplicável a esta transação.

Allowlist concluída de `ADM-REF-01F`: nova migration aditiva e pgTAP focado; rota `app/routes/admin.competitions.$competitionId.boxscores.import.tsx` e teste de domínio da action; componente `app/modules/boxscore/review-editor.tsx`; manifestos do Pacote 1 e `HANDOFF.md`. O escopo integrou a decisão privada somente à confirmação FIBA existente, sem criar submissões, fallback ou suplemento e sem alterar o parser.

Expansão de allowlist em 02/09/2026: `supabase/tests/database/fiba_boxscore_import.test.sql` e `supabase/tests/database/wp14_boxscore_enhancements.test.sql`. As fixtures sintéticas anteriores não tinham naipe explícito e a criação automática não transportava a escolha privada transitória; os testes foram classificados explicitamente sem alterar dados reais nem inferir valores.

Reconciliação inicial de `ADM-REF-01G` em 02/09/2026: branch limpa no head `1e4806d`; PR #35 aberta/draft com `gate`, `database`, preview e CodeQL verdes; `/health` do preview respondeu `preview/ok`; Supabase compartilhado na migration remota `20260902064839_boxscore_import_eligibility_enforcement`. O baseline possui 4 edições: 2 classificadas e vinculadas explicitamente a perfis, 2 pendentes; 44/44 atletas pendentes, 2 perfis ativos, 9 jogos, 48/48 elencos ativos, 2 imports confirmados e 19 auditorias. O changelog atual não trouxe quebra aplicável; novos contratos de API continuarão com grants explícitos.

Allowlist inicial de `ADM-REF-01G`: nova migration aditiva de transação/relatório de classificação; pgTAP focado; tipos TypeScript gerados se o contrato público mudar; relatório versionado em `docs/execution/ADM-REF-01G.md`; manifestos do Pacote 1 e `HANDOFF.md`. O escopo não inclui UI, enforcement, `NOT NULL`, remoção de fallback, alteração de histórico ou preenchimento de naipe/sexo sem entrada explícita.

Implementação concluída de `ADM-REF-01G`: migrations `20260902112735_classification_backfill_reconciliation.sql` e `20260902114608_classification_backfill_coverage_fix.sql`, quatro views privadas sem grants e RPC de relatório somente para `authenticated`, com guarda singleton AAL2 e `search_path` vazio. As escritas continuam exclusivamente nas RPCs explícitas existentes; não foi criado atalho de backfill. O relatório v2 contém evidência factual, filas sem valor privado, snapshots por edição, divergências, cobertura exata e checksums históricos. DDL integral, 40 pgTAP focados e regressões 55 + 24 + 26 + 32 passaram; formatação, lint, TypeScript, banco desde zero, preview e CodeQL ficaram verdes.

Gate intermediário de `ADM-REF-01G`: o commit `c474540` passou `gate`, banco desde zero, preview e CodeQL. A migration principal foi então aplicada ao Supabase compartilhado como `20260902114439_classification_backfill_reconciliation`. A reconciliação confirmou as contagens esperadas e nenhuma alteração histórica, mas revelou um erro isolado no relatório: o composto nulo de um `LEFT JOIN` era contado como uma linha de estatística coletiva em edições sem cobertura avançada.

Expansão de allowlist de `ADM-REF-01G` em 02/09/2026: migration aditiva `classification_backfill_coverage_fix`, atualização do pgTAP focado e dos relatórios de execução. A migration aplicada não será reescrita. A correção versiona o relatório como v2 e troca somente a contagem de cobertura; em rollback, as 40 asserções passaram e as edições sem estatística retornaram zero, sem alterar filas, dados ou checksums.

Reconciliação inicial de `ADM-REF-02A` em 02/09/2026: branch limpa no head `8cddd40`; PR #35 aberta/draft com `gate`, banco desde zero, preview e CodeQL verdes; `/health` respondeu `preview/ok`; Supabase compartilhado na migration remota `20260902115601_classification_backfill_coverage_fix`. A baseline contém 9 jogos (5 `seed`, 2 `manual`, 2 `boxscore`), 2 imports confirmados, 4 objetos privados e 19 auditorias; `public.game_data_submissions` ainda não existe. O changelog atual não trouxe quebra aplicável à modelagem, mas a mudança de exposição do Data API exige grants explícitos.

Allowlist inicial de `ADM-REF-02A`: uma nova migration aditiva de `game_data_submissions`; pgTAP focado; tipos TypeScript gerados; `docs/execution/ADM-REF-02A.md`; manifestos do Pacote 2 e `HANDOFF.md`. O escopo não inclui autoridade por domínio, view de estado, UI, backfill, adaptação dos fluxos atuais ou escrita de submissões no banco compartilhado.

Implementação concluída de `ADM-REF-02A`: o commit `2ddd8e9` passou `gate`, banco desde zero, preview e CodeQL antes da aplicação. A migration foi aplicada como `20260902163902_game_data_submissions`; o pgTAP persistido passou 40/40. A tabela ficou vazia, sem backfill, e os checksums de jogos, participantes, períodos, elencos, estatísticas, faltas, imports e auditoria permaneceram idênticos. Os tipos remotos confirmaram o contrato versionado. Não há advisor de segurança novo; três índices de FKs ainda sem uso são esperados antes da primeira submissão.

Reconciliação inicial de `ADM-REF-02B` em 02/09/2026: branch limpa no head `4a3bf37`; PR #35 aberta/draft com `gate`, banco desde zero, preview e CodeQL verdes; `/health` respondeu `preview/ok`; Supabase compartilhado na migration remota `20260902163902_game_data_submissions`, PostgreSQL 17.6. A baseline contém 9 jogos, 2 imports, 19 auditorias, zero submissões, zero duplicidade ativa e ainda não possui tabela ou view de autoridade. O changelog atual não trouxe quebra aplicável; novos objetos públicos continuarão com RLS e grants explícitos.

Allowlist inicial de `ADM-REF-02B`: uma migration aditiva de autoridade/capacidades/RPCs/view; pgTAP focado inclusive concorrência; tipos TypeScript gerados; `docs/execution/ADM-REF-02B.md`; manifestos do Pacote 2 e `HANDOFF.md`. O escopo não inclui comparação visual, UI, adaptação de súmula/boxscore, backfill, progressão, publicação ou alteração de dados esportivos compartilhados.

Implementação concluída de `ADM-REF-02B`: matriz fechada com 14 capacidades, autoridade única por jogo/domínio, FKs contextuais, proteção de submissão referenciada, RPCs AAL2 com advisory lock e compare-and-swap e visão administrativa derivada. O primeiro ciclo corrigiu o plano pgTAP de 60 para 62. A CI desde zero revelou ainda que `now()` permanece estável durante a transação e impedia uma troca válida no mesmo ciclo; a ativação passou a usar relógio de parede monotônico em relação à revisão anterior, e o teste do gatilho de proteção passou a executar como proprietário para alcançar a defesa interna além da negação de grants. O head `66c633e` passou gate, banco desde zero com 501 testes, preview e CodeQL; a migration principal foi aplicada como `20260902201619_game_data_domain_authority`. Os advisors pediram índices para os dois FKs compostos, corrigidos sem reescrever a migration aplicada. O head `7d085e4` passou gate, banco desde zero com 503 testes, preview e CodeQL; a migration aditiva foi aplicada como `20260903021740_game_data_domain_authority_fk_indexes`, o pgTAP persistido passou 64/64 e o advisor deixou de apontar FKs sem cobertura. A reconciliação preservou 9 jogos, 18 participantes, 48 placares por período, 50 vínculos de jogo, 74 estatísticas por atleta/período, 81 faltas, 2 imports e 19 auditorias; ficaram zero submissões/autoridades e 14 capacidades. A PR #35 segue aberta/draft e o preview responde `preview/ok`.

Implementação concluída de `ADM-REF-02C`: o commit funcional `51729e6` introduziu backfill determinístico, relatório AAL2 e 43 pgTAP. A primeira CI detectou que a chamada idempotente estava antes dos jogos no seed; a migration enviada não foi reescrita, e o commit `843de15` moveu somente a chamada para o final. O segundo ciclo aprovou gate, preview, CodeQL e 546 testes desde zero. A migration foi aplicada como `20260903074040_game_data_backfill`; o pgTAP persistido passou 43/43. O banco contém 9 submissões e 28 autoridades: os jogos 40/41 preservam hashes/chaves manuais e seis domínios cada; 62/63 preservam SHA-256, parser e objeto privado exato com oito domínios cada; os cinco seeds permanecem em `review`, sem ator inventado e sem autoridade. O relatório retorna `ready=true`, placares e pontos coerentes e zero domínio ausente. Os checksums de períodos, pontos, relacionados/DNP, faltas, desqualificações e imports continuaram respectivamente `847fefb7c39119447f3ae10eb0419b81`, `957293c09608e9af9fa5cddaddf69c35`, `9391932eaa5ffe47e5b4bd6e4d3629ba`, `132d68ea72222f1bd29085a9f4537205`, `92e018e0110ffc5cbb510f575323694c` e `85419d16fa779a4db25981803e118e58`. Advisors não apontaram falha nova: a RPC `SECURITY DEFINER` é deliberadamente exposta somente a `authenticated`, com guarda singleton AAL2 e `search_path` vazio; índices ainda sem uso são esperados no volume atual. O preview responde `preview/ok`, e não houve merge nem deploy de produção.

Implementação concluída de `MVP-01`: `e28ac3d` criou a estrutura versionada `ruleset → stage → round → matchup` e o comparador puro; `3055ec7` adaptou súmula manual e FIBA para confirmar somente um jogo existente, ativar autoridades compatíveis, manter validação assistida de atletas/estatísticas coletivas e bloquear novos jogos sem confronto; `d1fc5a9` limitou a exceção de fixtures à sessão do seed. O run CI `34347376702` aprovou aplicação desde zero, seed, pgTAP e gate; upload e CodeQL também passaram. As três migrations foram aplicadas transacionalmente ao Supabase compartilhado. A reconciliação retornou 4 rulesets, 9 matchups, 0 jogos sem matchup, 9 submissões (4 ativas/5 em review) e 28 autoridades, preservando a baseline. O smoke AAL2 no preview confirmou a seleção estrutural de `DEMO-01` na súmula e o histórico das duas fixtures FIBA. Nenhum dado esportivo foi regravado, e não houve merge nem produção.

1. Reconciliar novamente branch, PR #35, checks, preview e migrations antes de editar.
2. Ler integralmente `docs/plan/acelerado-mvp/README.md`, os arquivos gerais na ordem indicada e `pacotes/MVP-03-ADMIN-E-PRESETS.md`.
3. Executar o pacote vertical completo com testes focais durante a implementação e um único gate consolidado ao final; manter os oito cartões originais como checklist e preservar o corte pós-MVP.

### Primeiros arquivos a abrir

- `AGENTS.md`
- `HANDOFF.md`
- `docs/plan/README.md`
- `docs/plan/acelerado-mvp/README.md`
- `docs/plan/acelerado-mvp/00-ESCOPO-E-CORTE.md`, `01-REGRAS-INVIOLAVEIS.md`, `REVISAO-DO-PLANO.md`, `02-FILA-ACELERADA.md` e `pacotes/MVP-03-ADMIN-E-PRESETS.md`
- cartões `06A`, `06B`, `07A`, `07B`, `07C`, `07D`, `06E` e `06F` em `docs/plan/tasks-pr35/`, somente como requisitos detalhados

### Resultado esperado do próximo passo

`MVP-03` versionado e validado: edição privada criada transacionalmente por presets versionados de grupo único e eliminatória simples, administração navegável e estrutura compilada/ativada sem estado parcial.

## 7. Pacotes de trabalho

| Pacote | Estado | Observação |
| --- | --- | --- |
| WP-00 — Repositório e decisões iniciais | `DONE` | Baseline em `main`; proteção obrigatória indisponível no plano gratuito do repositório privado |
| WP-01 — Ambientes cloud | `DONE` | PR #2 integrada; preview bootstrap saudável |
| WP-02 — Scaffold, CI e preview | `DONE` | PR #3 integrada; preview por PR validado |
| WP-03 — Administrador único | `DONE` | PR #8 integrada; conta singleton, TOTP real, `aal2`, RLS e gate aprovados |
| WP-04 — Modelo canônico | `DONE` | PR #9 integrada; CI aplicou migrations/seed desde zero e pgTAP passou |
| WP-05 — Contexto e navegação pública | `DONE` | PR #10 integrada; E2E no preview e navegador real aprovados |
| WP-06 — Hub administrativo e elencos | `DONE` | PR #11 integrada no commit `07454a1`; todos os gates aprovados |
| WP-07 — Jogos e súmula manual | `DONE` | PR #12 integrada por squash no commit `49890f6`; produção não publicada |
| WP-08 — Página do jogo e estatísticas | `DONE` | PR #13 integrada por squash no commit `0cdd560`; produção não publicada |
| WP-09 — Importação de boxscore PDF | `DONE` | PR #14 integrada por squash no commit `91c59dd`; produção não publicada |
| WP-10 — Histórico, colocações e conquistas | `DONE` | PR #15 integrada por squash no commit `191069c`; produção não publicada |
| WP-11 — Desempenho e cache condicionado | `DONE` | PR #16 integrada por squash no commit `572127c`; cache dispensado por evidência |
| WP-12 — Observabilidade e recuperação | `DONE` | PR #17 integrada por squash no commit `526e900`; produção não publicada |
| WP-13 — Release de produção | `DONE` | `v1.0.3` ativa; rollout, métricas, logs, smoke público e smoke administrativo `aal2` aprovados; risco residual aceito pelo responsável |
| WP-14 — Estatísticas coletivas e cadastro assistido | `DONE` | PRs #24/#25 integradas; parser v2, hotfix de Storage, produção, retroprocessamento `aal2`, banco e páginas públicas aprovados |
| WP-15 — Fundação de perfis e privacidade | `READY` | PR #27 draft; gate, banco desde zero, pgTAP, preview/smoke e CodeQL aprovados; sem merge/deploy |
| WP-16 — Infraestrutura de tabelas e estados | `READY` | PR #28 draft; CI, preview, CodeQL e QA 390/1280 px aprovados; sem merge/deploy |
| WP-17 — Núcleo esportivo público | `READY` | PR #29 draft; CI #90, preview #70, CodeQL #91 e QA esportivo aprovados; sem merge/deploy |
| WP-18 — Perfil público do jogador | `READY` | PR #30 draft; CI #103, preview #83, CodeQL #104 e QA 390/1280 px aprovados; sem merge/deploy |
| WP-19 — Detalhe expandido do jogo | `READY` | PR #31 draft; CI, preview, CodeQL, reconciliação e QA aprovados; sem merge/deploy |
| WP-20 — Busca, navegação e comparador | `READY` | PR #32 draft; CI, preview, CodeQL e QA acessível aprovados; sem merge/deploy |
| WP-22 — Consolidação UI/UX do produto | `READY` | PR #34 draft; área pública, administração e autenticação no mesmo padrão branco/azul; CI, preview, CodeQL e QA responsiva aprovados; sem merge/deploy |
| WP-23 — Fluxos administrativos ágeis | `IN_PROGRESS` | Busca/criação segura de atletas, elenco, rascunhos, revisão de PDF e súmula compacta implementados localmente; gate da aplicação aprovado; pgTAP e preview ainda pendentes |
| ADM-REF-00 — Reconciliação e documentação | `DONE` | PR #35/branch/head reconciliados; plano mestre importado e índice atualizado; `public/__admin-preview.html` preservado |
| ADM-REF-01A — Compatibilidade de naipe, sexo e perfil | `DONE` | Schema compatível, filas, RPCs AAL2, RLS e pgTAP aprovados |
| ADM-REF-01B — Contextos e rotas públicas por naipe | `DONE` | Perfil versionado, URLs canônicas, fallback de rollout, 77 Vitest e 268 pgTAP aprovados |
| ADM-REF-01C — Revisão administrativa de naipe e perfil | `DONE` | Competição 8 classificada explicitamente como masculina e vinculada ao perfil #3 `manual_scoresheet`; sessão AAL2, quatro auditorias, idempotência, privacidade e jogo preservado validados |
| ADM-REF-01D — Formulário privado de sexo do atleta | `DONE` | Fluxos global/inline sem valor padrão, edição AAL2 justificada, impacto, auditoria sem valores, negações e ausência de vazamento validados localmente, no CI, no preview e no Supabase compartilhado |
| ADM-REF-01E — Elegibilidade em elenco e transferência | `DONE` | Novas associações validadas transacionalmente; histórico preservado; códigos `BD601`/`BD602`, idempotência, 26 pgTAP, rota, CI, preview e Supabase compartilhado aprovados |
| ADM-REF-01F — Elegibilidade na confirmação de importação | `DONE` | Confirmação FIBA valida criação/vínculo na mesma transação; pendência e incompatibilidade preservam review sem escrita parcial; parser sem inferência; 32 pgTAP, CI, preview e Supabase compartilhado aprovados |
| ADM-REF-01G — Classificação/backfill administrativo | `DONE` | Relatório v2 aplicado; histórico preservado; 2 edições sem naipe, 2 sem perfil e 44 atletas pendentes identificados; 40 pgTAP, CI, preview, CodeQL e Supabase aprovados |
| ADM-REF-02A — Submissões versionadas | `DONE` | Contrato imutável e protegido por AAL2 aplicado; tipos, 40 pgTAP e histórico vazio reconciliados |
| ADM-REF-02B — Autoridade por domínio | `DONE` | Matriz de 14 capacidades, autoridade única, concorrência, estado derivado, 64 pgTAP e índices de FKs aprovados |
| ADM-REF-02C — Backfill de submissões e autoridades | `DONE` | 9 submissões, 28 autoridades, 5 seeds somente históricos, relatório AAL2, 43 pgTAP e checksums esportivos preservados |
| MVP-01 — Jogo estrutural e ingestão principal | `DONE` | Estrutura versionada, ingestões no jogo existente, 92 Vitest, CI/database, preview AAL2 e Supabase compartilhado aprovados |
| MVP-02 — Jogadores públicos e estabilidade boxscore | `DONE` | Read models orientados por autoridade, 102 Vitest, 35 pgTAP, CI/database, preview responsivo e CodeQL aprovados |
| MVP-03 — Administração e criação por presets | `DONE` | Navegação, presets imutáveis, criação privada transacional, CI/database, concorrência e QA responsivo/teclado aprovados |
| MVP-04 — Agendamento, progressão básica e publicação | `DONE` | Agenda, progressão e publicação aplicadas; 37 pgTAP, advisors, checksums e smokes público/AAL2 aprovados sem mutação de QA |
| MVP-05 — QA, release candidata e handoff | `DONE` | Release `v1.1.0`, workflow protegido, smokes e produção aprovados |
| POST-01 — Fontes excepcionais e conflitos | `DONE` | PR #42 integrada em `abb2111`; schema, tipos, 87 pgTAP, advisors e smokes público/anônimo/AAL2 aprovados sem mutação |
| POST-02 — Ciclo administrativo e editor completo | `DOING` | PR #43 com quatro checks verdes; schema aplicado; pgTAP persistente 28+29+36; advisors/reconciliação verdes; QA AAL2 aguarda login/MFA no preview |

## 8. Arquivos e referências importantes

| Caminho esperado | Função |
| --- | --- |
| `AGENTS.md` | Regras permanentes para o Codex |
| `HANDOFF.md` | Estado e continuidade |
| `docs/plan/README.md` | Entrada do plano ativo |
| `docs/plan/tasks-pr35/README.md` | Entrada operacional com regras separadas, fila e um arquivo por task |
| `docs/plan/PLANO-TASKS-RETOMAVEIS-PR35.md` | Visão consolidada preservada para compatibilidade e auditoria |
| `docs/plan/PLANO-MESTRE-PR-FONTES-DE-DADOS-E-JOGADORES.md` | Fonte normativa consolidada da PR #35 |
| `docs/plan/PROMPT-MESTRE-IDE.md` | Mandato de execução |
| `docs/plan/PLANO-EXECUCAO.md` | Pacotes e critérios de conclusão |
| `docs/plan/ARQUITETURA-SEGURANCA.md` | Stack e regras obrigatórias |
| `docs/plan/MODELO-BOXSCORE-FIBA.md` | Contrato do formato FIBA/Genius Sports |
| `docs/plan/MODELO-BOXSCORE-SITE.md` | Contrato do formato Basketball Site |
| `docs/plan/FUTURO-OCR.md` | Alternativa futura, fora do escopo |
| `docs/plan/referencias/modelos-boxscore/` | Dois PDFs usados como fixtures |

## 9. Serviços e variáveis

Serviços configurados: repositório privado e environments no GitHub, Workers de preview e produção no Cloudflare e projeto gratuito saudável no Supabase. A produção `v1.0.3` está publicada na URL temporária da plataforma.

Registre aqui somente nomes de variáveis quando forem definidos. Nunca registre valores, tokens, cookies, senhas, chaves privadas, URLs com credenciais ou connection strings.

```env
APP_ENV
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
SESSION_SECRET
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

## 10. Comandos do projeto

- `npm ci` — instalação reproduzível pelo lockfile.
- `npm run format:check` — valida formatação com Biome.
- `npm run lint` — valida regras estáticas com Biome.
- `npm run typecheck` — gera tipos e executa TypeScript strict.
- `npm test` — executa Vitest.
- `npm run build` — gera builds cliente e SSR.
- `npm run scan:secrets` — varre arquivos versionáveis por credenciais conhecidas.
- `npm run check:runbooks` — valida conteúdo mínimo dos runbooks operacionais.
- `npm run check` — gate completo local e remoto.
- `npm run deploy:preview` — deploy do Worker de preview.
- `npm run deploy:production` — deploy de produção; permitido somente a partir de `main`.

## 11. Testes e evidências

- MVP-02 final em 09/09/2026: commits `b7c0030` e `603f725` implementaram read models públicos com `security_invoker`, RLS/grants mínimos, DTO discriminado por perfil/autoridade, ausência nula, DNP correto e denominadores total/avançado separados. O gate local aprovou 28 arquivos/102 Vitest e scan de 491 arquivos; CI/database `34386933182`, preview `34386933194` e CodeQL `34386933248` ficaram verdes, com 35 pgTAP focados. A migration foi aplicada aditivamente ao Supabase compartilhado. QA público em 390/768/1280 px confirmou súmula vazia honesta, 35 atletas FIBA, busca/ordenação restauráveis, perfil e jogo 63 em 93 × 39, foco visível e console sem erros. Nenhum merge ou deploy de produção foi executado.
- ADM-REF-01F final em 02/09/2026: a confirmação FIBA passou a validar somente novas associações e reativações, exigir escolha privada transitória para criação automática revisada e manter importações pendentes/incompatíveis em `review`. O payload persistido é sanitizado e não contém o valor privado; erros `BD601`/`BD602` identificam apenas atleta/equipe de origem; o corpo legado ficou sem execução para `authenticated`. O gate local aprovou Biome em 116 arquivos, TypeScript, 23 arquivos/88 Vitest, quatro runbooks, builds cliente/SSR e scan de 447 arquivos. Os 32 pgTAP focados e as suítes FIBA (23) e WP14 (31) passaram em rollback; CI `33600273383`, preview `33600273368` e CodeQL `33600273484` ficaram verdes no commit funcional `9f10393`. A migration remota `20260902064839_boxscore_import_eligibility_enforcement` foi aplicada e retestada. O banco permaneceu com 44/44 perfis pendentes, 48/48 elencos ativos, 19 auditorias, 9 jogos, zero importações em review e zero valor privado persistido em resolução. A prévia autenticada exibiu AAL2 e a rota FIBA/Genius sem overflow na janela de 820 px nem logs de console; nenhum import artificial foi criado apenas para QA.
- ADM-REF-01E final em 01/09/2026: `admin_replace_roster` passou a validar somente atletas que entram/reentram, na mesma transação da associação, com locks do elenco, edição e perfil privado; repetição exata é no-op e associações históricas incompatíveis permanecem preservadas. `BD601` identifica pendência e `BD602` incompatibilidade sem transportar o valor privado. O atalho de elenco deixou de rotular previamente atletas como elegíveis. O gate local aprovou Biome em 115 arquivos, TypeScript, 22 arquivos/85 Vitest, quatro runbooks, builds cliente/SSR e scan de 444 arquivos. O primeiro CI `33579634988` confirmou as 26 novas asserções e revelou somente a fixture legada sem classificação; após corrigi-la com valores explícitos sintéticos, CI `33579854976` aprovou `gate`, migrations/seed desde zero e 14 arquivos/324 pgTAP. Preview `33579855036` e CodeQL `33579855069` passaram. A migration remota `20260902013629_roster_eligibility_enforcement` foi aplicada; `anon` não executa a RPC. No preview AAL2, salvar o elenco histórico sem alterações foi idempotente e tentar associar o atleta 36 pendente retornou a decisão curta; a recarga e o banco confirmaram 48/48 elencos ativos, 19 auditorias e zero associação nova.
- ADM-REF-01C local em 28/08/2026: nova rota AAL2 de revisão de naipe/perfil com fallback explícito para schema antigo, seleção sem valor padrão, prévia de impacto e mutações somente pelas RPCs auditadas de `01A`. `npm.cmd run check` aprovou formatação e lint de 111 arquivos, TypeScript estrito, 21 arquivos/81 testes Vitest, quatro runbooks, builds cliente/SSR e scan de 435 arquivos. O teste focado de domínio aprovou 7 cenários; `git diff --check` também passou.
- ADM-REF-01C remoto em 28/08/2026: CI `33201272488` aprovou `gate` e `database` com migrations/seed desde zero e pgTAP; preview `33201272349` publicou a PR #35 e aprovou smoke contextual público; CodeQL `33201272434` passou. A rota `/admin/competitions/1/data-profile` respondeu `302 /admin/login` para visitante anônimo. O caminho AAL2 completo continua pendente porque o schema compartilhado ainda está no rollout anterior.
- ADM-REF-01C em 01/09/2026: sessão real exibiu `aal2`; competição 8 abriu pendente, com 1 jogo preservado, nenhum valor sugerido e nenhum campo privado. HTTP anônimo retornou `302 /admin/login` com cookie `HttpOnly`, `Secure` e `SameSite=Strict`; as views seguras têm 0 colunas privadas e `anon` não executa os RPCs administrativos. QA em 390/768/901 px não encontrou overflow ou erro de console. Auditoria confirmou `mfa_verified` seguido de `admin_access`; `admin_mutation_audit` permaneceu em 11 linhas porque nenhuma classificação foi inferida ou gravada.
- ADM-REF-01C final em 01/09/2026: o responsável selecionou manualmente `male` e `manual_scoresheet` para a competição 8. O banco confirmou perfil #3 ativo/versão 1, revisão e vínculo concluídos, jogo 6 ainda `scheduled`, quatro eventos auditados e total de auditoria estável em 15 após recarga; nenhuma duplicata ou coluna privada apareceu. `G-FLOW` aprovado e `01D` liberada.
- ADM-REF-01D final em 01/09/2026: migration aditiva criada pela CLI oficial para cadastro atômico, leitura dedicada e alteração idempotente do dado privado. Cadastro global e inline exigem seleção explícita sem valor padrão; o inline mostra o naipe público ao lado. A edição protegida exige AAL2, motivo e prévia de inscrições/edições afetadas; logs e auditoria omitem valores. O gate local aprovou formatação/lint de 114 arquivos, TypeScript, 21 arquivos/81 testes Vitest, quatro runbooks, builds cliente/SSR e scan de 441 arquivos. CI `33553915740` aprovou `gate` e `database` desde zero, incluindo 24 pgTAP focados; preview `33553915719` e CodeQL `33553915725` passaram. O preview aprovou AAL2, negação anônima, QA 390/768/1280, foco do inline, busca genérica sem o campo e smoke público canônico. A migration remota `20260901201250_player_private_admin_flow` foi aplicada; os RPCs negam `anon`, 44/44 perfis continuam pendentes e nenhum dado foi inferido ou preenchido.
- Gate inicial de 27/08/2026: `npm.cmd run check` chegou ao lint e falhou somente nas duas callbacks `forEach` do arquivo não rastreado `public/__admin-preview.html`; a falha foi classificada como preexistente e o arquivo foi preservado sem alterações.
- Baseline versionada de 27/08/2026: lint/formatação dos 104 arquivos aplicáveis, 20 arquivos/71 testes Vitest, typecheck estrito, quatro runbooks, builds cliente/SSR e scan de 360 arquivos aprovados; Vitest e scan exigiram execução fora do sandbox por bloqueio `EPERM` de subprocessos.
- ADM-REF-01 banco em 27/08/2026: migration `20260827160000_data_profile_gender_compatibility.sql`, seed compatível e 47 novos asserts de naipe/perfil/privacidade; CI `33105220358` reconstruiu o Supabase do zero e aprovou 12 arquivos/261 testes pgTAP, além do gate completo da aplicação.
- ADM-REF-01 contratos em 28/08/2026: contextos e URLs canônicas por naipe, perfil versionado, seletor legado sem inferência e conquistas contextualizadas no head `ccef3f1`; 21 arquivos/77 testes Vitest, typecheck e builds aprovados. CI `33168520809` reconstruiu o banco e aprovou 12 arquivos/268 testes pgTAP; preview `33168520776` e smoke contextual aprovados após fallback seguro para schema antigo.
- Testes executados: `npm run check` aprovado; 6 testes Vitest; quatro cenários RLS diretos aprovados; smokes admin/CSRF/health aprovados.
- Provisionamento real: exatamente 1 usuário Auth ativo, 1 vínculo em `private.admin_accounts`, 1 fator TOTP verificado e 1 sessão ativa com método `totp`; correspondência singleton confirmada.
- Auditoria real: 2 eventos `mfa_verified` registrados pelo fluxo; a conta real em `aal2` é reconhecida e enxerga a auditoria sob RLS.
- Negação real: a mesma identidade simulada em `aal1` é reconhecida como singleton, mas `is_current_admin_aal2()` retorna falso e nenhuma linha de auditoria fica visível.
- Gate final local: Biome em 34 arquivos, TypeScript strict, 4 arquivos/6 testes Vitest, builds cliente e SSR e varredura de 233 arquivos aprovados; `npm ci` auditou 175 pacotes com 0 vulnerabilidades.
- Dependências: `npm install` auditou 175 pacotes e não encontrou vulnerabilidades.
- GitHub Actions: CI #10, preview #9 e CodeQL #10 aprovados na PR #8.
- CodeQL: SARIF de 70.839 bytes preservado por 14 dias; upload ao Code Scanning indisponível no plano atual do repositório privado.
- Falhas conhecidas: nenhuma funcional no WP-03.
- Incidente de CI resolvido: o teste de adulteração alterava o último caractere Base64URL, que podia preservar os bytes decodificados por causa do padding; agora altera deterministicamente o meio do ciphertext autenticado.
- Evidências de pacotes: registrar em `docs/execution/WP-XX.md`.
- WP-12 gate local: Biome em 69 arquivos, TypeScript strict, 12 arquivos/43 testes Vitest, quatro runbooks, builds cliente/SSR e scan de 298 arquivos aprovados.
- WP-12 staging: cópia lógica temporária preservou 3/3 linhas e checksum; rollback real do Worker detectou incompatibilidade pelo smoke público e restauração da candidata recuperou `/health` e HTTP 200.
- WP-12 observabilidade: eventos `health` e `auth` conferidos ao vivo no Worker fixo de staging; o log customizado contém somente a allowlist operacional e nenhum payload da aplicação.
- WP-13 pré-release: 1 usuário/1 MFA/1 admin, 4 competições, 6 equipes, 44 atletas, 9 jogos, 2 imports confirmados, 2 PDFs privados, 23 eventos de auditoria, RLS integral e 0 órfãos.
- WP-13 gate local inicial: Biome em 71 arquivos, TypeScript strict, 43 Vitest, quatro runbooks, build e scan de 301 arquivos aprovados.
- WP-13 smoke administrativo em produção: sessão `aal2`, dashboard e hub protegido aprovados; logout e nova tentativa anônima redirecionaram para `/admin/login`; auditoria confirmou `mfa_verified`, `admin_access` e `logout`.
- Decisão de risco: senha administrativa preenchida automaticamente apareceu na saída técnica da inspeção pós-logout. Sessões encerradas, nenhuma persistência em código ou serviços e rotação recomendada; o responsável recusou conscientemente a alteração e aceitou o risco residual.
- Recovery não utilizado: Supabase Auth confirmou `user_recovery_requested`, `/recover` HTTP 200 e envio do e-mail `recovery`; o responsável pode descartar a mensagem.
- WP-13 gate após o incidente: Biome em 72 arquivos, TypeScript strict, 12 arquivos/43 Vitest, quatro runbooks, builds cliente/SSR e scan de 303 arquivos aprovados; nenhum segredo persistido no Git.
- WP-14 gate local: Biome em 72 arquivos, TypeScript strict, 12 arquivos/43 Vitest, quatro runbooks, builds cliente/SSR e scan de 305 arquivos aprovados.
- WP-14 banco: migration integral aprovada em rollback e persistida; CI/database desde zero aprovou 28/28 novas asserções de RLS, métricas, criação/vinculação, duplicidade, rollback, auditoria, refresh e idempotência.
- WP-14 remoto: PR #24 com `gate`, `database`, `upload` e `analyze` aprovados no head `917f25c`; preview público e smoke contextual aprovados.
- WP-14 hotfix: PR #25 e `main` com CI, banco desde zero e CodeQL aprovados; workflow `32764216293` publicou a versão `1f004752-dd64-4bc7-8406-917c0ba30248` e aprovou os smokes.
- WP-14 recuperação: objetos novos com 105.166/104.676 bytes e MIME PDF; imports 12/13 apontam para os caminhos recuperados, parser `fiba-genius-v2`, 2 linhas coletivas e 1 geral por jogo, além de 1 auditoria por import.
- WP-14 público: jogos 62 e 63 exibem garrafão, segunda chance, contra-ataque, banco, liderança, sequência, pontos por posse, tempo em vantagem, mudanças de liderança e empates com os valores dos fixtures.
- WP-15 remoto: PR #27; CI #81, banco desde zero/pgTAP, preview #61 e CodeQL #82 aprovados no head documental `ba9448d`.
- WP-16 remoto: PR #28 no head funcional `e545bcc`; CI #86, banco desde zero/pgTAP, preview #66 e CodeQL #87 aprovados.
- WP-16 navegador: 1280 × 800 e 390 × 844 sem overflow do documento; busca/URL, ordenação/`aria-sort`, preset após recarga, cartão mobile, sombras e rolagem superior/inferior sincronizada em 420 px aprovados.
- WP-17 remoto: PR #29 no head funcional `f9ca6d1`; CI #90, banco desde zero/pgTAP, preview #70 e CodeQL #91 aprovados.
- WP-17 navegador: agendado sem 0 × 0, próximos/encerrados, `status=final`, classificação 3 × 2, agregados de equipes e tabela móvel 318/614 px sem overflow aprovados.
- WP-18 remoto: PR #30 no head funcional `2e10f95`; CI #103, preview #83 e CodeQL #104 aprovados.
- WP-18 navegador: perfil 2025/2026, cinco hashes, nav fixa, privacidade e 390 × 844/1280 × 800 sem overflow aprovados.
- WP-19 remoto: PR #31 no head funcional `cfed10e`; CI #109, preview #89 e CodeQL #110 aprovados.
- WP-19 navegador: jogo 63 com placar/totais 93 × 39 reconciliados, titulares, DNP, cinco tabelas e métricas recolhíveis; jogo 5 agendado sem 0 × 0; 390 × 844/1280 × 800 sem overflow.
- WP-20 remoto: PR #32 no head funcional `f1145db`; CI #120, preview #100 e CodeQL #121 aprovados.
- WP-20 navegador: busca `alvares` encontrou Álvares sem acento; `2025` agrupou edição/categoria; setas e Escape aprovados; comparador 38 × 34 restaurou seleção e totais pela URL, com links e textos de melhor/menor/empate.
- WP-22 remoto: PR #34 no head `7ef5144`; CI `33009112506`, preview/smoke `33009112457` e CodeQL `33009112447` aprovados.
- WP-22 navegador: busca local/global, presets, filtro explícito, chips, paginação 20/15, comparador com seleção rápida, Escape/foco e perfil de três seções aprovados; 320/390/736/1024/1280 px sem overflow do documento.
- WP-04 SQL: 34/34 asserts aprovados em rollback integral e novamente no esquema remoto persistido; todas as 19 tabelas de aplicação com RLS.
- WP-04 advisors: nenhum item de performance acionável; avisos remanescentes são índices recém-criados ainda sem uso, schema privado sem policy por desenho e proteção de senha vazada disponível apenas no plano pago.
- WP-04 gate local: Biome em 34 arquivos, TypeScript strict, 4 arquivos/6 testes Vitest, builds cliente/SSR e varredura de 238 arquivos aprovados.
- WP-04 gate remoto: PR #9 com CI/gate, database desde zero, preview e CodeQL aprovados; merge `b92c5c1`.
- WP-05 staging: consulta sob papel `anon` confirmou 3 contextos, 2 anos, 2 categorias, 2 equipes, 2 atletas e 3 jogos.
- WP-05 gate local inicial: Biome em 43 arquivos, TypeScript strict, 6 arquivos/12 testes Vitest, builds cliente/SSR e scan de 247 arquivos aprovados.
- WP-05 gate remoto: CI/gate, database desde zero, preview com smoke contextual e CodeQL aprovados na PR #10.
- WP-05 navegador: troca 2026/Sub-15 → Sub-17, recurso Jogos, voltar/avançar, reload, troca para 2025, 404 inválido e `/admin/login` validados.
- WP-05 merge: PR #10 integrada por squash no commit `85c6913`; produção não publicada.
- WP-06 banco: 16 asserts de inscrição/elenco e 5 asserts de histórico de camisas aprovados em rollback e no staging persistido.
- WP-06 gate local: Biome em 46 arquivos, TypeScript strict, 7 arquivos/14 testes Vitest, builds cliente/SSR e scan de 255 arquivos aprovados.
- WP-06 gate remoto inicial: PR #11 com CI/gate, database desde zero, preview/smoke público e CodeQL aprovados no commit `25fae07`.
- WP-06 navegador: sessão real no host `pr-11`, selo `AAL2`, dashboard e hub 2025/Sub-15 validados; reenvio idempotente do elenco com camisa `00` concluído sem erro.
- WP-06 auditoria real: evento `roster_replaced` append-only registrado para a inscrição com uma entrada, confirmado diretamente no banco.
- WP-06 merge: PR #11 integrada por squash no commit `07454a1`; produção não publicada.
- WP-07 banco: migration transacional e 19 pgTAP aprovados em rollback integral e novamente no staging persistido.
- WP-07 gate local final: Biome em 50 arquivos, TypeScript strict, 8 arquivos/26 testes Vitest, builds cliente/SSR e scan de 264 arquivos aprovados.
- WP-07 advisors: FK `games.created_by` indexada; nenhum item acionável de segurança/performance permanece além dos avisos já documentados e índices novos sem uso.
- WP-07 gate remoto: CI executou migrations/seed desde zero, todas as suítes pgTAP e o gate da aplicação; preview, smoke público automatizado e CodeQL aprovados na PR #12.
- WP-07 navegador: sessão real `aal2`, editor com duas equipes/elencos, placar ao vivo, encerramento e detalhe público aprovados. O primeiro smoke revelou `/games/:id` inválido; a correção para `/jogos/:id` recebeu teste de regressão e o segundo smoke redirecionou corretamente.
- WP-07 auditoria real: `SMOKE-WP07-02` persistiu como `manual`/`final`, placar derivado 3×1, 4 períodos, 2 relacionados, 8 linhas de estatísticas e um evento append-only `manual_scoresheet_saved` correspondente.
- WP-07 merge: PR #12 integrada por squash no commit `49890f6`; produção não publicada.
- WP-08 banco: views `security_invoker` por jogo/edição aplicadas; fixtures `STATS-01` de 2025 e 2026 isoladas; 14 pgTAP aprovados no staging.
- WP-08 gate local: Biome em 55 arquivos, TypeScript strict, 9 arquivos/32 testes Vitest, builds cliente/SSR e scan de 271 arquivos aprovados.
- WP-08 desempenho inicial do banco: detalhe de jogo filtrado executou em 1,408 ms no staging com índices contextuais existentes.
- WP-08 gate remoto: CI/database desde zero, preview/smoke automatizado e CodeQL aprovados na PR #13.
- WP-08 smoke HTTP: Jogadores 2025/2026, tabela/comparação, jogos 45/46, boxscore e placares isolados 2×3/8×6 aprovados; contexto inválido respondeu 404.
- WP-08 benchmark HTTP no Worker, 30 amostras: Jogadores p50 702,2 ms / p95 793,6 ms; jogo p50 979,5 ms / p95 1.083,0 ms.
- WP-08 merge: PR #13 integrada por squash no commit `0cdd560`; produção não publicada.
- WP-09 parser: os dois PDFs oficiais geram o mesmo contrato; ALC 58–67 AVABES (5205808) e IVV 93–39 CAC (5205822) reconciliados.
- WP-09 banco: migrations de importação/limite/funções privadas aplicadas; 23 pgTAP aprovados no remoto e novamente pelo CI desde zero.
- WP-09 gate local: Biome, TypeScript strict, 11 arquivos/39 testes Vitest, builds cliente/SSR Worker, scan de 283 arquivos e auditoria npm com zero vulnerabilidades.
- WP-09 remoto: PR #14 com `gate`, `database`, `upload` e `analyze` aprovados no commit `f2ea9d7`; smoke público contextual do preview aprovado.
- WP-09 navegador: sessão real `aal2`; ALC 58–67 AVABES e IVV 93–39 CAC importados, revisados e exibidos publicamente; duplicata recusada por hash.
- WP-09 reconciliação: 2 importações confirmadas, 2 jogos finais, 4 participantes, 8 períodos, 16 placares por período, 42 slots/associações/totais, 81 faltas, 2 objetos privados e 2 auditorias, sem parcial ou excedente.
- WP-09 merge: PR #14 integrada por squash no commit `91c59dd`; produção não publicada.
- WP-10 banco: migration integral aprovada em rollback e persistida; 27 pgTAP aprovados, inclusive negações, idempotência, conflito e RLS anônima.
- WP-10 staging: 4 colocações, 4 conquistas de equipe e 4 de atleta em 2025/2026; advisors sem novo item acionável.
- WP-10 gate local: Biome, TypeScript strict, 11 arquivos/40 testes Vitest, builds cliente/SSR Worker e scan de 286 arquivos aprovados.
- WP-10 preview administrativo: sessão real `aal2`; alteração/restauração do rótulo confirmadas pelo RPC, duas auditorias `final_placement_confirmed` registradas e fixture final preservada.
- WP-10 remoto: PR #15 limpa para merge; `gate`, `database`, `upload` e `analyze` aprovados no head `225df5b` antes da evidência documental final.
- WP-10 merge: PR #15 integrada por squash no commit `191069c`; produção não publicada.
- WP-11 SQL representativo: 250 jogos/240 atletas/6.000 slots/24.000 linhas; simples 158,089 ms e avançado 196,174 ms, abaixo da meta de 250 ms.
- WP-11 HTTP no preview, 30 amostras: estatísticas p50 318 ms/p95 711 ms; jogo FIBA p50 374 ms/p95 597 ms, abaixo das metas de 1.000/1.500 ms.
- WP-11 decisão: nenhum cache ou índice novo; medições e advisors não demonstraram necessidade.
- WP-11 CI: a primeira execução tratou o benchmark em `supabase/tests/` como pgTAP sem plano; o arquivo opt-in foi movido para `supabase/benchmarks/`, preservando a suíte automática.
- WP-11 remoto: PR #16 com `gate`, `database`, `upload` e `analyze` aprovados no head `88135ca`; estatísticas e jogo FIBA validados no preview.

## 12. Git

- Repositório: `https://github.com/renato-lucindo/base-do-basquete` (privado).
- Branch de trabalho: `feature/admin-workflow-improvements`, head remoto funcional `603f725` do `MVP-02` com gate local, CI/database, preview e CodeQL aprovados.
- Evidência funcional integrada em `main`: PR #24 no commit `3b7929d` e hotfix da PR #25 no commit `8544734`.
- Checks das PRs #24/#25 e da `main`: `gate`, `database`, `upload` e `analyze` aprovados.
- Produção confirmada após o merge com `/health` retornando `environment=production` e `status=ok`.
- PRs funcionais atuais: #27 a #32 em draft e empilhadas; nenhum merge ou deploy executado.
- Consolidação atual: PR #35 draft contra `main`, head funcional `603f725`, aberta; nenhum merge ou deploy de produção executado.
- Execução atual: commits `b7c0030` e `603f725` concluíram `MVP-02`; CI/database `34386933182`, preview `34386933194` e CodeQL `34386933248` estão verdes.
- Head atual da PR #35: `fec70a5`. Publicação editorial versionada, hardening, tipos integrais e evidências passaram `gate`, banco desde zero, preview/smoke e análise. Nenhum merge ou deploy de produção foi executado.
- Supabase compartilhado após publicação: quatro competições `published` com versão atual, uma `draft`, nove jogos e doze inscrições. Migrations `20260914113513_mvp04_versioned_publication` e `20260914114432_mvp04_publication_hardening` aplicadas; 37/37 pgTAP persistentes e hashes esportivos preservados.
- Este documento é o follow-up final pós-merge; para o HEAD mais recente, consultar `git log --oneline -10`.

## 13. Bugs, riscos e bloqueios conhecidos

- Não existe acesso ao repositório antigo; isso é decisão de greenfield, não bloqueio.
- Login, MFA ou CAPTCHA podem exigir ação pontual do responsável.
- Qualquer plano pago exige aprovação explícita.
- Uma branch Supabase isolada custaria US$ 0,01344/h; não foi criada. O banco de produção foi validado transacionalmente antes das migrations persistidas e reconciliado antes do release.
- Docker não está instalado neste host; o reset local do Supabase desde zero não pôde ser executado. O fallback remoto foi DDL integral em rollback, aplicação versionada e testes repetidos no esquema persistido.
- O advisor informa que a proteção de senhas vazadas está desativada; o recurso exige plano Pro e não será habilitado sem autorização de upgrade. A política gratuita já exige 12 caracteres, maiúsculas, minúsculas, dígitos e símbolos, além de MFA obrigatório.
- O advisor informa RLS sem policy em `private.admin_accounts`, `private.competition_creation_requests` e `private.player_private`; isso é intencional porque o schema é privado, sem grants ao cliente, e o acesso ocorre somente por funções internas restritas. Os avisos SECURITY DEFINER restantes são RPCs administrativas deliberadamente limitadas ao singleton AAL2. A proteção de senhas vazadas continua indisponível no plano atual. Referências: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy, https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable e https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
- GitHub Code Scanning nativo está indisponível para o repositório privado no plano atual; o workflow gera e preserva SARIF como alternativa sem custo.
- A escolha e configuração de domínio devem aguardar instrução futura.
- Não reduzir MFA, RLS, autorização backend ou proteção de segredos para acelerar a primeira temporada.
- Dois objetos PDF históricos vazios permanecem no Storage como evidência do incidente; nenhum import aponta para eles. A remoção futura é destrutiva em produção e exige autorização explícita.
- O advisor de segurança lista como intencionais as tabelas privadas com RLS sem policy/grants e os RPCs administrativos `SECURITY DEFINER` expostos somente a `authenticated`; cada RPC valida o administrador singleton em `aal2` e fixa `search_path = ''`. A proteção de senhas vazadas continua indisponível no plano atual.
- `private.boxscore_upload_attempts` permanece sem RLS desde o fluxo legado. A tabela está em schema não exposto e `anon`/`authenticated` não têm privilégios de leitura ou escrita, mas o diagnóstico genérico recomenda RLS como defesa em profundidade. Nenhuma alteração foi feita fora do escopo de `ADM-REF-01G`; reavaliar em um cartão de hardening antes do fechamento global.

## 14. O que não deve ser refeito ou antecipado

- Não reconstruir as 156 tarefas antigas individualmente; elas são somente referência de cobertura.
- Não procurar o repositório anterior.
- Não redesenhar o plano antes de iniciar sem evidência de impedimento real.
- Não implementar múltiplos administradores, convites, RBAC ou gestão de usuários.
- Não implementar OCR, parser genérico ou súmula oficial completa.
- Não pesquisar ou configurar domínio.
- Não criar microserviços, cache distribuído ou infraestrutura local persistente sem necessidade comprovada.

## 15. Atualização ao encerrar uma sessão

Antes de encerrar, substitua o estado acima por fatos atuais e registre:

- pacote e tarefa em andamento;
- último item concluído e respectiva evidência;
- próximo passo exato, incluindo arquivo/serviço e validação;
- branch, último commit e resumo do `git status`;
- arquivos alterados e mudanças ainda não concluídas;
- comandos executados e resultados reais;
- bugs, bloqueios e tentativas realizadas;
- decisões técnicas novas e seus motivos;
- alterações nos ambientes GitHub, Cloudflare e Supabase.

Não deixe informação essencial apenas na conversa. Faça commit e push do handoff quando for apropriado e seguro.

## 16. Registro de handoffs

| Data | Sessão/agente | Estado deixado | Próximo passo |
| --- | --- | --- | --- |
| 2026-08-21 | Planejamento inicial | Plano concluído; implementação não iniciada | Executar WP-00 e criar o repositório privado |
| 2026-08-21 | Codex | Pacote lido; baseline WP-00 pronta localmente; GitHub exige login | Autenticar GitHub, criar remoto privado e publicar WP-00 |
| 2026-08-21 | Codex | GitHub privado e Supabase gratuito criados; WP-00 concluído | Integrar fechamento do WP-00 e criar Worker de preview no WP-01 |
| 2026-08-21 | Codex | WP-00 integrado; Supabase saudável; Worker bootstrap passa no gate local | Autenticar Cloudflare e publicar preview do WP-01 |
| 2026-08-21 | Codex | Cloudflare/GitHub configurados; preview publicado e smoke HTTP 200 | Integrar WP-01 por PR e iniciar WP-02 |
| 2026-08-21 | Codex | WP-02 com PR #3, CI, preview, CodeQL/SARIF e smoke aprovados | Integrar PR #3 e iniciar WP-03 |
| 2026-08-21 | Codex | WP-03 técnico aprovado na PR #8; conta real e TOTP ainda não criados | Responsável cria usuário sem compartilhar senha; Codex registra ID e valida MFA |
| 2026-08-21 | Codex | Única conta Auth criada e vinculada atomicamente ao singleton; advisors revisados | Responsável conclui o TOTP no preview; Codex valida `aal2`, auditoria e gate final |
| 2026-08-21 | Codex | TOTP real verificado; sessão `aal2`, auditoria, RLS e gate consolidado aprovados | Aguardar checks do head final, integrar PR #8 e criar branch do WP-04 |
| 2026-08-21 | Codex | PR #8 integrada; WP-04 migrado no Supabase, seed privado, tipos, 34 testes SQL e gate local aprovados | Publicar PR do WP-04 e integrar somente com checks verdes |
| 2026-08-21 | Codex | PR #9 integrada; WP-05 com rotas e fixtures contextuais, 12 testes e gate local aprovados | Commitar WP-05 e validar smoke contextual no preview |
| 2026-08-21 | Codex | PR #10 com CI/database, preview/smoke, CodeQL e navegação real aprovados | Enviar evidências finais, reconfirmar head e integrar sem produção |
| 2026-08-21 | Codex | PR #10 integrada; WP-06 com RPCs, hub, elencos, camisas, 21 asserts SQL e gate local aprovados | Abrir PR e validar fluxo administrativo real no preview |
| 2026-08-21 | Codex | PR #11 com todos os checks verdes; MFA/AAL2, hub, gravação idempotente e auditoria real aprovados | Enviar evidências finais, reconfirmar checks e integrar o WP-06 |
| 2026-08-21 | Codex | PR #11 integrada; WP-07 com transação, editor, 19 pgTAP, 25 testes e gate local aprovados | Commitar, abrir PR e validar um jogo completo no preview autenticado |
| 2026-08-21 | Codex | PR #12 com CI/preview e smoke `aal2` aprovados; jogo manual, placar, atomicidade, auditoria e redirecionamento público validados | Enviar evidências finais, marcar PR pronta e integrar sem produção |
| 2026-08-21 | Codex | PR #12 integrada; WP-08 com views contextuais, fixtures de duas edições, páginas públicas, 14 pgTAP e gate local aprovados | Commitar, abrir PR, validar preview e medir p50/p95 HTTP |
| 2026-08-21 | Codex | PR #13 com todos os gates verdes; smoke 2025/2026, boxscore, 404 e benchmark p50/p95 aprovados | Enviar evidências finais, marcar PR pronta e integrar sem produção |
| 2026-08-24 | Codex | PR #13 integrada; WP-09 implementado na PR #14 com parser dos dois PDFs, 23 pgTAP, 39 Vitest e todos os checks verdes | Fazer login/MFA no host da PR #14, importar os dois PDFs, testar duplicata e integrar sem produção |
| 2026-08-24 | Codex | WP-09 validado em `aal2`: dois jogos finais, duplicata recusada, banco/Storage/auditoria reconciliados | Enviar evidências, reconfirmar o head da PR #14 e integrar sem produção |
| 2026-08-24 | Codex | PR #14 integrada; WP-10 com RPC `aal2`, views históricas, 27 pgTAP, fixtures e gate local aprovados | Abrir PR do WP-10 e validar administração/perfis no preview |
| 2026-08-24 | Codex | PR #15 com todos os gates verdes; smoke `aal2`, auditoria e históricos de equipe/atleta reconciliados | Enviar evidência final, integrar WP-10 e criar a branch do WP-11 |
| 2026-08-24 | Codex | PR #15 integrada; WP-11 mediu SQL/HTTP com volume e metas explícitos, sem justificar cache | Executar gate, abrir PR do WP-11 e validar o preview final |
| 2026-08-24 | Codex | PR #16 com gates verdes; benchmark opt-in separado de pgTAP e preview público aprovado | Enviar evidência final, integrar WP-11 e criar a branch do WP-12 |
| 2026-08-24 | Codex | PR #16 integrada; WP-12 instrumentado e gate local/ensaios de recuperação em staging aprovados | Commitar WP-12, abrir PR #17 e validar logs redigidos no Worker de preview |
| 2026-08-24 | Codex | PR #17 com quatro checks verdes; head promovido em staging e eventos redigidos confirmados ao vivo | Enviar evidências finais, reconfirmar gates e integrar WP-12 sem produção |
| 2026-08-24 | Codex | PR #17 integrada; WP-13 com advisors/reconciliação, secrets isolados e workflow de release seguro preparado | Abrir PR #18, integrar com gates verdes e publicar pela `main` |
| 2026-08-24 | Codex | PR #18 integrada e tag `v1.0.0` criada; primeiro dispatch recusado por YAML antes de qualquer deploy | Integrar correção em bloco literal e repetir o dispatch pela `main` |
| 2026-08-24 | Codex | `v1.0.3` publicada; gate automatizado, logs, métricas e rollout 10% → 100% aprovados, com rollback preservado | Responsável conclui login/TOTP no host estável; Codex valida `aal2` e integra a evidência final |
| 2026-08-24 | Codex | Smoke de produção confirmou `aal2`, hub, logout e auditoria; senha autofill apareceu na inspeção e foi declarada comprometida | Responsável rotaciona a senha no Supabase sem compartilhá-la; novo login/MFA libera o gate final da PR #22 |
| 2026-08-24 | Responsável/Codex | Responsável recusou conscientemente a rotação e aceitou o risco residual; WP-13 marcado `DONE` sem reduzir os controles de segurança | Executar gate final, integrar PR #22 por squash e confirmar produção saudável |
| 2026-08-24 | Codex | PR #22 integrada por squash em `2e7e530` após quatro checks verdes; produção respondeu `production/ok` | Plano atual encerrado; próxima mudança começa em nova branch WP após conferir `main` e `/health` |
| 2026-08-24 | Codex | WP-14 implementado; migration validada/aplicada; 28 pgTAP, CI, CodeQL e preview público aprovados na PR #24 | Enviar evidência documental, integrar pela `main`, publicar produção e retroprocessar os dois PDFs em `aal2` |
| 2026-08-24 | Responsável/Codex | PRs #24/#25 publicadas; arquivos recuperados; imports 12/13 retroprocessados em `aal2`; banco, auditoria e jogos 62/63 reconciliados | Integrar o handoff final e iniciar novo WP somente após nova demanda de produto |
| 2026-08-24 | Codex | WP-15 implementado na PR #27; gate, migrations desde zero, 26 pgTAP novos, preview/smoke e CodeQL aprovados | Manter PR #27 draft e criar PR 2 empilhada a partir do head `737b321` |
| 2026-08-24 | Codex | WP-16 implementado na PR #28; CI #86, preview #66, CodeQL #87 e QA responsivo/interativo aprovados | Retargetar a PR #28 para a PR #27 e iniciar a PR 3 empilhada, sem merge/deploy |
| 2026-08-24 | Codex | WP-17 implementado na PR #29; jogos, classificação, equipes, CI #90, preview #70, CodeQL #91 e QA aprovados | Retargetar a PR #29 para a PR #28 e iniciar PUB-04 na PR 4 |
| 2026-08-24 | Codex | WP-18 implementado na PR #30; perfil completo, fallback seguro de rollout, CI #103, preview #83, CodeQL #104 e QA aprovados | Retargetar a PR #30 para a PR #29 e iniciar PUB-06 na PR 5 |
| 2026-08-24 | Codex | WP-19 implementado na PR #31; boxscore/totais e métricas expandidas separados, CI #109, preview #89, CodeQL #110, reconciliação e QA responsivo aprovados | Retargetar a PR #31 para a PR #30 e iniciar busca/navegação/comparador na PR 6 |
| 2026-08-24 | Codex | WP-20 implementado na PR #32; busca server-side limitada, menu agrupado e comparador por URL; CI #120, preview #100, CodeQL #121 e QA acessível aprovados | Retargetar a PR #32 para a PR #31 e iniciar administração/hardening na PR 7 |
| 2026-08-25 | Codex | WP-22 consolidado na PR #34; gate/database, preview/smoke, CodeQL e QA em cinco larguras aprovados | Apresentar preview ao produto e aguardar aprovação explícita antes de merge/produção |
| 2026-08-26 | Codex | Escopo do WP-22 ampliado para o projeto inteiro; dashboard, hub, elencos, súmula, importação, autenticação e estados globais migrados para o padrão aprovado, com checks e QA responsiva aprovados | Apresentar a prévia atualizada ao produto e aguardar aprovação explícita antes de merge/produção |
| 2026-08-27 | Codex | Pacote 0 reconciliou a PR #35 no head `89dd9e9`, importou o plano mestre e preservou o HTML não rastreado; gate inicial identificou somente o lint preexistente desse HTML | Criar a migration aditiva de compatibilidade do Pacote 1 e provar RLS, privacidade e unicidade por pgTAP |
| 2026-08-27 | Codex | Primeira unidade do ADM-REF-01 no head `6192cde`: compatibilidade de naipe/sexo/perfil, filas e RPCs; CI desde zero e 261 pgTAP aprovados | Atualizar contratos e contextos para consumir o perfil versionado com fallback legado explícito |
| 2026-08-28 | Codex | Contratos/contextos do ADM-REF-01 no head `ccef3f1`: URLs por naipe, perfil versionado, fallback de rollout, 77 Vitest, 268 pgTAP e preview/smoke aprovados | Implementar revisão administrativa de naipe/perfil e coleta privada de sexo sem valor padrão |
| 2026-08-28 | Codex | Plano da PR #35 dividido em 50 tasks atômicas, fila serial, gates e protocolo de retomada; `01C` é o único cartão `READY` | Executar somente `ADM-REF-01C` e não antecipar `01D`/`01E`/`01F` |
| 2026-08-28 | Codex | Plano operacional reorganizado em 67 arquivos Markdown: regras, fila, 10 índices de pacote e 50 arquivos de task; ZIP autocontido gerado fora do Git | Abrir `docs/plan/tasks-pr35/README.md` e executar somente o arquivo de `ADM-REF-01C` |
| 2026-08-28 | Codex | `ADM-REF-01C` em `REVIEW` no WIP `047f555`: rota AAL2, fallback de rollout, seleção explícita, impacto e RPCs auditadas; check local, CI/database, preview e CodeQL verdes | Autorizar schema alvo e concluir smoke/QA AAL2 antes de marcar `01C` como `DONE`; não iniciar `01D` |
| 2026-08-31 | Responsável/Codex | Cadeia de schema da PR #35 aplicada ao Supabase compartilhado com `birth_date` preservada e sempre nula; 27 + 12 + 55 pgTAP remotos passaram e dados canônicos permaneceram reconciliados | Commitar/pushar a compatibilidade, aguardar checks e concluir smoke/QA AAL2 da `ADM-REF-01C`; não iniciar `01D` |
| 2026-09-01 | Responsável/Codex | Login/MFA real na PR #35 confirmado; rota 01C, negação anônima, privacidade, auditoria e QA responsivo somente leitura aprovados sem qualquer mutação de domínio | Responsável define naipe e fonte principal da competição 8; executar o smoke AAL2 de gravação sem inferência e concluir `G-FLOW` |
| 2026-09-01 | Responsável/Codex | Responsável concluiu manualmente a competição 8 como masculina com perfil `manual_scoresheet`; perfil #3, quatro auditorias, recarga idempotente, privacidade e jogo preservado reconciliados; `01C` em `DONE` | Executar exclusivamente `ADM-REF-01D` e não antecipar `01E`/`01F` |
| 2026-09-01 | Codex | `ADM-REF-01D` concluída: fluxo privado AAL2, 81 Vitest, 24 pgTAP focados, CI/database, preview, CodeQL e Supabase compartilhado reconciliados; automação desta tarefa ativa a cada 5 horas | Executar exclusivamente `ADM-REF-01E` e não antecipar `01F` |
| 2026-09-01 | Codex | `ADM-REF-01E` concluída: validação transacional de elenco/transferência, histórico preservado, 85 Vitest, 324 pgTAP, CI/database, preview, CodeQL e Supabase compartilhado aprovados | Executar exclusivamente `ADM-REF-01F` e não antecipar `01G` |
| 2026-09-02 | Codex | `ADM-REF-01F` concluída: importação FIBA valida elegibilidade sem inferência, preserva review e atomicidade, 88 Vitest, 32 pgTAP focados, CI/database, preview, CodeQL e Supabase compartilhado aprovados | Executar exclusivamente `ADM-REF-01G` e não antecipar `01H` |
| 2026-09-02 | Codex | `ADM-REF-01G` concluída no head `60b00a6`: relatório v2 aplicado, 40 pgTAP e todos os gates verdes; `01H` adiada com 2/2/44 pendências e sem autorização de enforcement | Executar exclusivamente `ADM-REF-02A` |
| 2026-09-02 | Codex | `ADM-REF-02A` concluída: migration `20260902163902_game_data_submissions`, 40 pgTAP, tipos, CI/database, preview, CodeQL, advisors e histórico reconciliados; zero backfill | Executar exclusivamente `ADM-REF-02B` |
| 2026-09-03 | Codex | `ADM-REF-02B` concluída: migrations de autoridade/índices, 64 pgTAP, 503 testes desde zero, tipos, preview, CodeQL, advisors e histórico reconciliados; zero submissões/autoridades | Executar exclusivamente `ADM-REF-02C` |
| 2026-09-03 | Codex | `ADM-REF-02C` concluída: migration de backfill, 43 pgTAP, 546 testes desde zero, 9 submissões, 28 autoridades, relatório pronto e checksums esportivos preservados | Executar exclusivamente `ADM-REF-02D` |
| 2026-09-03 | Codex | Plano operacional acelerado: 39 cartões restantes consolidados em 5 pacotes MVP e 4 pós-MVP, com cobertura 50/50, segurança preservada e `MVP-01` pronto | Executar `MVP-01` com um gate remoto consolidado |
| 2026-09-09 | Codex | `MVP-01` concluído: jogo estrutural, ingestões no jogo existente, 92 Vitest, banco desde zero/pgTAP, preview AAL2 e Supabase compartilhado reconciliados no head `d1fc5a9` | Executar `MVP-02 — Jogadores públicos e estabilidade boxscore` |
| 2026-09-09 | Codex | `MVP-02` concluído: read models por autoridade, ausência/DNP corretos, 102 Vitest, 35 pgTAP, todos os checks remotos e QA público responsivo aprovados no head `603f725` | Executar `MVP-03 — Administração e criação por presets` |
| 2026-09-11 | Codex | `MVP-04` com agenda, progressão e publicação versionada implementadas no head `09a992d`; gate local, 743 pgTAP desde zero, preview/smoke e análise verdes; migration de publicação ainda não aplicada | Obter autorização explícita para retropreencher as quatro competições publicadas e trocar as policies públicas; aplicar migration, tipos, pgTAP persistente, advisors e QA AAL2 |
| 2026-09-14 | Responsável/Codex | Backfill autorizado e aplicado; quatro versões atuais, 37 pgTAP, advisors, checksums esportivos e smoke público aprovados; hardening em `dfd0813` com checks verdes | Renovar login/TOTP da PR 35, executar o smoke AAL2 de revisão/publicação sem publicar a fixture 100 e então iniciar MVP-05 |
| 2026-09-14 | Responsável/Codex | MVP-04 fechado após smoke AAL2 sem mutação; MVP-05 iniciou com QA 390/768/1440, teclado, privacidade, runbook e smoke automatizado de release | Passar gate/CI do MVP-05, atualizar PR e preparar integração/candidata somente pela main verde |
| 2026-09-14 | Codex | PR #35 integrada em `37bf85c`; candidata `cc9cece2-e4e9-49c2-a444-c04cfb154ca0`; produção `68445c64-df5c-42ff-870e-08c0fc0f432d` saudável após propagação; primeiro workflow falhou só no redirect raiz transitório | Integrar retry limitado em PR curta e repetir deploy da main para fechar o workflow verde |
| 2026-09-14 | Codex | MVP-05 concluído: PRs #39/#40 verdes, `main` `f8dcb87`, tag `v1.1.0`, Worker `f3505b09-a831-4e0a-a2a7-5f0960b17d7b` e workflow de produção `34845342461` integralmente aprovados | Iniciar `POST-01` e acompanhar a cauda de latência do detalhe de jogo conforme ADR 0003 |
| 2026-09-14 | Codex | POST-01 implementado na branch `feature/post-01-sources-conflicts`: fallback/suplemento, snapshots, staging do PDF posterior, comparação, decisão AAL2 e projeção rara passaram gates locais e ensaios SQL descartáveis | Abrir PR, aguardar CI/banco/preview/CodeQL; só então aplicar schema, regenerar tipos e executar QA AAL2 |
| 2026-09-14 | Codex | PR #42 verde no head `76b87d2`; nove migrations aplicadas; 87 pgTAP persistidos, tipos, advisors, checksums e smoke público/anônimo aprovados; produção intocada | Responsável faz login/MFA no host da PR #42; validar a tela de conflito em AAL2 sem mutação e fechar POST-01 |
| 2026-09-14 | Responsável/Codex | Smoke real da PR #42 confirmou sessão AAL2 e tela de conflito vazia segura do jogo 5205822, sem mutação; head `c68b0ff` com quatro checks verdes | Enviar a evidência, reconfirmar os checks, marcar a PR pronta e integrar; depois iniciar POST-02 em branch própria |
| 2026-09-14 | Codex | PR #42 integrada por squash em `abb2111`; POST-01 `DONE`; branch `feature/post-02-admin-cycle` criada da `main`; produção intocada | Implementar migration e pgTAP da política transacional de remoção/retirada do POST-02 |
| 2026-09-15 | Codex | Política `remove`/`withdraw`/`blocked`, proteção contra bypass, auditoria, 28 pgTAP e UI AAL2 implementadas localmente; Biome e TypeScript direto verdes; schema remoto e produção intocados | Repetir pgTAP em rollback e Vitest focal quando o executor liberar subprocessos; então iniciar clonagem profunda |
| 2026-09-15 | Codex | Clonagem profunda AAL2 implementada localmente: filtros de origem, recompilação explícita entre naipes, grafo com IDs independentes, UI e 29 pgTAP; nenhuma migration persistida | Implementar editor apenas em draft e executar gate consolidado antes do push |
| 2026-09-15 | Codex | Editor draft AAL2/CAS/idempotência/auditoria implementado com UI de etapas, rodadas, confrontos e origens; 36 pgTAP em rollback; remoção 28/28 e clone 29/29; gate local completo com 290 Vitest, build e scan de 563 arquivos | Revisar escopo residual do editor, commitar, enviar somente para a branch POST-02 e executar CI/banco/preview antes de aplicar schema persistente; produção intocada |
| 2026-09-15 | Codex | PR draft #43 no head `3fb2be0` com gate/database(927)/preview/CodeQL verdes; três migrations aplicadas; pgTAP persistente 28+29+36, advisors e reconciliação aprovados; preview aberto no login | Responsável conclui login/MFA na PR #43; Codex executa smoke AAL2 das três unidades sem mutação destrutiva e fecha o gate da PR; produção permanece `v1.1.0` |
| 2026-09-15 | Responsável/Codex | Smoke AAL2 da PR #43 aprovou clone independente, editor CAS com restauração, retirada somente leitura, negação anônima e reconciliação; gate local com 290 testes e scan de 563 arquivos passou | Enviar evidências, reconfirmar os quatro checks, integrar a PR #43 e iniciar POST-03 em branch própria; produção permanece `v1.1.0` |
| 2026-09-15 | Codex | PR #43 integrada por squash em `48511d1`; branch `feature/post-03-sports-exceptions` criada da main e migration vazia `20260915205114_post03_group_closure.sql` gerada pelo CLI | Implementar snapshot imutável e resolução de vagas do encerramento de grupos com pgTAP focal; não antecipar W.O., emendas, push ou produção |
| 2026-09-16 | Responsável/Codex | POST-03 concluído: 29+33+34+8+11 pgTAPs persistentes, migrations/tipos/advisors reconciliados, quatro checks verdes e smoke AAL2 das três seções sem mutação; estado vazio corrigido em `8e62abf` | Enviar evidência final, integrar a PR #44 e preparar o POST-04 sem aplicar invariantes antes da autorização humana obrigatória |
| 2026-09-16 | Codex | PR #44 integrada por squash em `51e640a`; POST-04 iniciado em `feature/post-04-enforcement-closure`; migration final auto-bloqueante, 21 pgTAP e registro de execução preparados; gate local com 298 Vitest/build/scan verde; ensaio remoto recusou corretamente 2/2/43 pendências e deixou o schema intacto | Abrir PR draft, validar banco desde zero na CI e adaptar fixtures se necessário; não aplicar no Supabase compartilhado nem publicar produção antes de zerar as filas e receber autorização explícita |
| 2026-09-16 | Codex | PR draft #45 no head `9d10913`; quatro checks verdes; seed e fixtures migrados para o contrato final; 37 arquivos/910 pgTAP e concorrência aprovados desde zero; quatro suítes de rollout nulo preservadas fora do gate; Supabase compartilhado e produção inalterados | Responsável classifica competições 1/9 e 43 atletas; depois autoriza explicitamente a aplicação, que deve ser seguida por tipos, pgTAP persistente, advisors, reconciliação e QA AAL2 antes de integrar |
| 2026-09-16 | Codex | Baseline pré-enforcement somente leitura versionada: inventário e seis hashes esportivos preservados; advisors sem erro e somente avisos preexistentes documentados; PR #45 continua draft e Supabase/produção continuam sem alteração | Responsável classifica competições 1/9 e 43 atletas; depois autoriza explicitamente a aplicação, seguida por tipos, pgTAP persistente, advisors, reconciliação e QA AAL2 antes de integrar |
| 2026-09-16 | Codex | Manual funcional do painel administrativo criado em `docs/PAINEL-ADMINISTRATIVO.md`, cobrindo recursos, segurança, sequência operacional, limites e estado do POST-04; README atualizado; nenhum serviço alterado | Manter a PR #45 draft; responsável classifica competições 1/9 e 43 atletas antes do enforcement final |
| 2026-09-16 | Codex | Fila AAL2 `/admin/review-queues` implementada com allowlist server-side e links diretos; nenhum valor privado é transportado; 44 arquivos/302 Vitest, TypeScript, Biome, build, runbooks e scan de 586 arquivos aprovados localmente | Commitar/enviar para a PR #45, validar preview e então o responsável conclui 2/2/43 revisões antes do enforcement |
| 2026-09-16 | Codex | PR #45 verde no head `468b1fa`; fila administrativa publicada no preview; smoke anônimo redirecionou ao login com cabeçalhos seguros; Supabase/produção inalterados | Responsável conclui login/MFA na PR #45, valida a fila e realiza 2/2/43 revisões explícitas; depois autoriza o enforcement final |
| 2026-09-16 | Responsável/Codex | Login AAL2 da PR #45 confirmado; fila exibiu 2 naipes, 2 perfis e 43 atletas, links para competições 1/9 e 43 formulários protegidos; tela sem formulário/campo privado e sem mutação | Responsável conclui as 2/2/43 decisões pela fila aberta e depois autoriza explicitamente o enforcement final |
| 2026-09-16 | Responsável/Codex | Enforcement autorizado e gate rechecado: competições concluídas (`0/0`), mas 43 atletas ainda pendentes; auditoria contém 2 revisões de naipe, 2 de perfil e nenhuma revisão privada de atleta; migration não aplicada | Responsável salva os 43 formulários privados; Codex revalida `0/0/0/0` e executa o enforcement já autorizado |
| 2026-09-16 | Responsável/Codex | Primeira revisão individual salva; fila em `0/0/42/0`. Revisão em lote adicionada à PR #45, RPC AAL2 aplicada, pgTAP com 17 asserções, QA de seleção/busca/limpeza sem submissão e produção preservada | Responsável envia as 42 decisões restantes pela fila em lote; Codex aplica o enforcement já autorizado somente após `0/0/0/0` |
| 2026-09-16 | Responsável/Codex | Responsável autorizou predefinir como masculinos os atletas pendentes; preview confirmou `42/42` masculinos e troca/restauração de uma exceção feminina sem submissão; quatro checks verdes no head `433011a` | Responsável revisa as predefinições, troca eventuais exceções e confirma o lote; Codex só aplica o enforcement após `0/0/0/0` |
| 2026-09-16 | Responsável/Codex | UX em lote redesenhada na PR #45 com os 14 itens autorizados: checkboxes, filtros/ordenação persistidos, contexto por time/competição, resumo, presets editáveis, tabela/cartões, barra fixa e CAS atômico. Migration `20260916202436_admin_review_queue_context_and_concurrency` aplicada; fila remota permanece `0/0/42/0`, teste de conflito `BD409` aprovado sem gravação, 312 Vitest e gate local completos | Commitar e enviar a unidade, aguardar os quatro checks, validar o preview responsivo/autenticado sem submissão; responsável então revisa e envia as 42 decisões, e o enforcement já autorizado só ocorre após `0/0/0/0` |
| 2026-09-16 | Responsável/Codex | Implementação dos 14 itens publicada no head `9b356bd`; `gate`, banco desde zero, upload e análise verdes. O primeiro banco falhou somente porque o teste de rollout encontrou a constraint futura do enforcement; a simulação foi isolada em transação e a repetição passou com 23/23 asserções. Preview AAL2 confirmou 42 resultados, seleção vazia segura, masculino apenas ao marcar, resumo por time/competição, filtro de AVABES em URL com 12 resultados, escolha preservada e limpeza sem submissão | Responsável revisa e envia as 42 decisões pela nova fila; Codex reconcilia `0/0/0/0`, aplica o enforcement final já autorizado, regenera tipos, repete pgTAP/advisors/QA e só então prepara integração; produção permanece `v1.1.0` |
| 2026-09-17 | Responsável/Codex | As 42 decisões restantes foram salvas; filas `0/0/0/0`; enforcement final aplicado sem remover colunas; 21/21 pgTAP, hashes/inventário, advisors, tipos, gate local e smoke AAL2 aprovados | Commitar e enviar a evidência, aguardar os quatro checks, integrar a PR #45 e publicar somente pela `main` protegida |
| 2026-09-17 | Codex | PR #45 integrada em `392cbb7`; primeiro deploy aplicou o Worker e aprovou smokes, mas o benchmark detectou a rota legada com redirect 308 | Corrigir somente o alvo canônico do benchmark em PR curta e repetir uma vez o workflow protegido |
| 2026-09-17 | Codex | PR #46 integrada em `bd248f9`; workflow `35225504568`, Worker `e06a4898-f214-45d9-b6f8-eaa9c193ef89` e tag `v1.2.0` verdes; estratégia econômica de testes documentada | Plano acelerado encerrado; iniciar nova branch apenas sob nova demanda e monitorar a cauda FIBA com evidência adicional |
| 2026-09-18 | Codex | Baseline de acessibilidade implementada em `5b95716` e publicada na PR #50: Sienna 2.2.333 local e complementar, skip link, redução de movimento, regras permanentes e 315 testes/gate completos. Os quatro checks e o QA do preview passaram; zoom real de 200% ficou pendente por limitação do navegador embutido. PR #49 preservada sem merge | Revisar/integrar a PR #50 quando autorizado e validar 200% de zoom após deploy em navegador compatível; não declarar conformidade WCAG |
| 2026-09-21 | Responsável/Codex | PR #50 integrada em `79e510d`; PRs #27–#34 encerradas como substituídas pela #35. Responsável autorizou remover a exclusividade FIBA e consolidar as demais PRs úteis em uma única branch | Concluir compatibilidade, gate local, PR consolidada e validações remotas sem aplicar migration compartilhada |
| 2026-09-21 | Codex | PR #51 aberta com conteúdo útil das PRs #4/#6/#7/#38/#48/#49; originais encerradas; dois pareceres aprovados; gate/database/preview/CodeQL verdes no head funcional `1a013fc`; Supabase compartilhado e produção inalterados | Revisar e autorizar o merge da #51; aplicar a migration somente depois, em unidade própria com validação persistente |
