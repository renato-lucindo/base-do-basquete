# HANDOFF — Base do Basquete

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

