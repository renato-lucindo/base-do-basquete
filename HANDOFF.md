## Produção validada; encerramento editorial — 17/10/2026

WORK_UNIT=INTEGRATE-86-87-77-ROLLOUT; OWNER=project-maintainer; WRITE_LOCK=ACTIVE até publicação do checkpoint, com liberação auditada no comentário final da PR documental; BRANCH=codex/release-evidence-20261017. Gates técnicos concluídos; escopo remanescente apenas publicação editorial, sem novas alterações funcionais, migrations ou dados. O estado remoto final da PR/issue83 complementa este checkpoint de publicação.

PRs86/87/77 MERGED. Artefato produtivo862288a6ac2f09a0801b33a0a32c4c6c7f58b1d6; CI38994244713/CodeQL38994244720 SUCCESS, cinco pareceres independentes e aprovação QA para ativação controlada6228529557. TagGitrelease-20261016-862288a6ac2f e tagCloudflarerelease-862288a6ac2f. Workflow38994916521 carregou candidata; produção ativada2026-10-17T02:30:38.425Z: versão95633298-cd5d-4e28-8fa6-d17a255d6a34, deployment95502bdd-5867-4f18-b784-96330e90bb46,100%. APP_ENVproduction, sem exceção de senha preview. Rollback4a89109e compatível com schema e leitura pública/health verificados. Preview padrão01cf5441-8300-44f2-8ad2-20a2489fe28c, deployment47d44d77-07fd-449d-ad84-e76a12bc7070, com senha preview preservada.

Supabase:19migrations aplicadas em transação única conformeSQL8b7b4b58e1cae1115e98a7b2c7939bbff950ee60c73f7e802ac32c2582e35474.71tabelas/12membros publicados reconciliados,7temporadas/9competições/10jogos/20inscrições/4publicadas preservados; Auth/RLS/ACL existentes inalterados;19fontes do histórico conferidas exatamente. Backup criptografado externo e recuperação estão emdocs/execution/SHARED-ROLLOUT-20261016.md. Ratificação de banco e registros remotos: issue83comentários6228381769/6228485288.

Pós-ativação: smokes health/headers/adminentry, público contextual e segurança/privacidade PASS. Responsável concluiu novo login/MFA no contexto Chrome isoladoproduction-release-862288a: POSTlogin→MFA→admincompetições200. Auditoria confirma mfa_verified2026-10-17T02:32:21.178543Z e admin_access02:32:22.276875Z. GETsegurança autenticado posterior200 confirma dois fatores; correlation313740b5-9d32-4ffe-8f96-21970d41f49c. Nenhuma senha/código/cookie/token consultado.

Benchmark inicial10amostras/3aquecimentos: jogadoresp50705,3ms/p95775,7ms PASS; detalheFIBAp50798,2ms/p952375,6ms acima da meta1500ms, falha preservada. A única repetição predefinida30amostras no mesmo artefato, sem mudar metas/código, passou: jogadoresp50587,2ms/p95670,6ms eFIBAp50553,4ms/p95825,2ms. Investigador APPROVE_WITH_NON_BLOCKING_NOTES, causa do pico INCONCLUSIVE; não alegar correção causal nem SLO universal. JSONs e parecer emdocs/execution/production-benchmarks-20261017.json ePERFORMANCE-RELEASE-20261017.md. QA final2026-10-17T04:29:34Z APPROVE_WITH_NON_BLOCKING_NOTES revogou a pendência de encerramento, aceitou MFA/smokes/desempenho delimitado; relatórioQA-RELEASE-20261017.md. Gate técnicoREADY_FOR_CLOSURE; publicação editorial final e encerramento remoto83 seguem no escopo do lock.

Issue84 CLOSED após correção/rollout. Pendências não bloqueantes próprias: issue88 título vazio na aba do editor (P2 acessibilidade, h1 correto; não corrigido), issue89 histórico de migrations/branching. Supabase Preview continuaFAIL, classificado explicitamenteNOT_APPLICABLE ao gate funcional após certificação focal de seis contratos já instalados e57aliases; nenhuma equivalência integral de87fontes alegada e nenhum repair/reapply executado. Disposição6228485546 e parecer6228485288. Referências corretas dos pareceres funcionais: banco6228227689,QA6228228118,estatística6228227894,boxscore6228232281,acessibilidade6228239670; o checkpoint histórico abaixo inverteu QA/estatística.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; SERVICO=PR documental codex/release-evidence-20261017 e issue83; ACAO=publicar este checkpoint/relatórios com gate editorial proporcional, conferir checks e integrar somente documentação; liberar lock e encerrar83 com URLs verificadas. Se esses estados remotos já estiverem concluídos, iniciar unidade separada paraissue88 emapp/routes/admin.games.$gameId.scoresheet.keyboard.tsx, definir meta descritiva e validar título noGET/navegação; depois planejarissue89 com banco. CRITERIO=evidências duráveis e Git limpo; título verificado sem mudanças de Auth/SQL; nunca reparar histórico às cegas nem republicar produção por alteração apenas documental.

## Integração e rollout autorizados — 16/10/2026 (histórico)

WORK_UNIT=INTEGRATE-86-87-77-ROLLOUT; OWNER=project-maintainer; WRITE_LOCK=ACTIVE; BRANCH_LOCAL=codex/pr77-release-integration; BRANCH_REMOTA=codex/keyboard-scoresheet-mvp.

Responsável autorizou realizar toda a sequência: integrar86/87, reconciliar migrations necessárias, concluir77/revisões e publicar produção somente após gates. Isso substitui as proibições históricas de merge/rollout abaixo, sem autorizar ações destrutivas sobre dados. PR86 integrada em01414463e946aecc6b5dc2c22cc5e9454f8eb655 após pareceres/gates; PR87 integrada em31034f061b91d36fed0ff716d081dc9472c2c44f após gate541/70, CI38991171704 e pareceres incrementais6228014883/6228014993. Novo checkout77 preserva worktrees anteriores e worker-configuration.d.ts alheio. Merge de87 sobre77 teve somente conflitoHANDOFF; ambos históricos preservados.

PR77 funcionalc804042068e24fabea46c3c5181c8f411227fb43: CI38992530500/CodeQL38992530505/preview38992530520 SUCCESS.587Vitest/72arquivos,1509pgTAP/55,35Playwright/2skip, concorrência, GoTrue/MFA/AAL2 e Chromium fallback/retry/HTTP409/confirmação/recuperação/cleanup PASS. Quatro regressões locais de recuperação/descarte e gate consolidado PASS; scan777. O harness seleciona CLOUDFLARE_ENV=production para exercer MFA real descartável. Cinco pareceres APPROVE_WITH_NON_BLOCKING_NOTES encerraram explicitamente bloqueios: banco6228227689, QA6228228118, estatística6228227894, boxscore6228232281, acessibilidade6228239670. Sem mudanças funcionais após este SHA; checkpoint posterior somente documental. Neste checkpoint históricoPR77 ainda era draft; o estado final está registrado acima.

Supabase compartilhadoyjnbemfeyjhxhomprlnm: migrations antigas66 registradas como20261005140439/20261005140504, Auth20261016130432 já aplicada; não reaplicar. Inventário antes do rollout:7temporadas/9competições/10jogos/20inscrições/4publicadas. Produção atual4a89109e-1b78-4f13-aa57-b45764f40338; preview4e6a91a3-14c8-4673-85e8-183828ab5ed0. Preflight/reconciliação e revisão de rollout precedem qualquer aplicação.

Backup criado2026-10-17T01:47:22.939Z: dumpPG17 public/private/auth/storage+roles sem senhas de roles e seis PDFs privados, AES256GCM; decriptação/checksums/catálogo e readback externo PASS. KV privado90f6c94e6b534a138ed3f9cd6d4fc3ea/pre-rollout/20261016/8D33EAE7; chave somente no secretGitHubBDB_BACKUP_KEY_20261016_8D33EAE7. Detalhes, SHA256 e recuperação emdocs/execution/SHARED-ROLLOUT-20261016.md eissue83comentário6228156629. Não depender de arquivos locais; nunca publicar dados/chave neste repositório público.

Rollout preparado com19fontes exatas, histórico atômico e aliases preservados; SQLSHA2568b7b4b58e1cae1115e98a7b2c7939bbff950ee60c73f7e802ac32c2582e35474. Ensaio sobre cópia atual remota restaurada em PostgreSQL17 isolado PASS02:05:50Z:71tabelas existentes reconciliadas,12inscrições publicadas preservadas,Auth/RLS/ACL existentes inalterados. Apenas backfillpublic_name/updated_at e colunas previstas são normalizados, com assertivas exatas. Cluster local parado/removido. Não houve DDL remoto, deploy ou merge77 neste checkpoint. Revisão independente do procedimento em andamento; não equivale a aprovação de aplicação remota.

Produção antiga corresponde ao SHA3ae53341f4b708f7b0d3afdf49f0309f34850c82 (run36171540445): Worker não referencia competition_seasons/competitive_division/public_name; health200, raiz302 para visao-geral com página final200. Smoke atual espera contrato classificação mais novo e não pode certificar essa versão antiga. Main sem proteção(API404); release deverá ser por versão marcada conforme AGENTS, com gates reais. Chrome DevTools list_pages respondeu; aba2 PR77 aguardando login manual (sem leitura de credencial/cookie), aba1 PR86 autenticada preservada.

PROXIMO_PASSO_EXATO: SERVICO=Supabase compartilhado/PR77; ACAO=obter parecer do procedimento8b7b4 e publicar este checkpoint documental; aplicar19migrations atomicamente somente se aprovado; validar previewPR77 autenticado após login humano, integrar77 com checks válidos; carregar candidata de mainverde/versão marcada e promover após gates; CRITERIO=histórico exato,71tabelas/12membros reconciliados,pareceres/gates válidos e smokes efetivos, sem perda de dados/segredos. Não encerrar issues83/84 antes da verificação correspondente.

## Issue #83 / PR #77 — Chromium passou; encerramento do servidor de teste — 16/10/2026

WORK_UNIT: PR77-FALLBACK-RETRY-HISTORY-20261014; OWNER: project-maintainer; WRITE_LOCK: ACTIVE; BRANCH_LOCAL: codex/pr77-fallback-review-fixes-20261014; BRANCH_REMOTA: codex/keyboard-scoresheet-mvp; PR: OPEN/DRAFT; RISK_LEVEL: CRITICO; READY_FOR_MERGE: NO; BLOCK_RELEASE: YES.

EVIDENCIA: no HEAD `2cee308`, o CI `38934367508` passou em gate e acessibilidade; database concluiu migrations, pgTAP, concorrencia e integracao GoTrue/AAL2. O log da etapa Chromium registrou `PASS: real browser login/MFA, fallback, retry, concurrent edit conflict and recovery` em 16:49:12Z, apos o fluxo completo, mas o processo Node nao terminou e o job foi cancelado por timeout de 20 minutos em 17:05:16Z. Assim, a transicao do setup e a confirmacao FIBA passaram; o bloqueio atual e o encerramento do harness, nao uma falha comprovada de regra de negocio.

CORRECAO_EM_VALIDACAO: `scripts/test-keyboard-disposable-browser.mjs` inicia npm/Vite em grupo de processos proprio no Linux e sinaliza todo o grupo no `finally`, fecha os pipes do subprocesso e o Chromium e registra a conclusao do cleanup. O codigo anterior encerrava somente o processo pai npm, possivelmente deixando Vite e pipes abertos. Atribuicao exata do handle ainda depende do novo CI. `worker-configuration.d.ts` segue modificado por geracao anterior; preservar fora dos commits. Nenhuma migration compartilhada, merge ou deploy.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; SERVICO=GitHub Actions CI/database PR77; ACAO=verificar gate local, publicar o cleanup, confirmar que o job database termina SUCCESS com mensagem de cleanup, depois atualizar REVIEW_PACKET e renovar pareceres independentes de banco/seguranca, estatisticas, boxscore, acessibilidade e QA no SHA final; CRITERIO_DE_CONCLUSAO=CI/CodeQL/Preview verdes no mesmo SHA e revisoes sem bloqueios, PR ainda DRAFT. Issue #84 permanece P2 para unidade isolada posterior.

## Issue #83 / PR #77 — confirmação Chromium e fixture FIBA — 16/10/2026

WORK_UNIT: PR77-FALLBACK-RETRY-HISTORY-20261014; OWNER: project-maintainer; WRITE_LOCK: ACTIVE; BRANCH_LOCAL: codex/pr77-fallback-review-fixes-20261014; BRANCH_REMOTA: codex/keyboard-scoresheet-mvp; PR: OPEN/DRAFT; RISK_LEVEL: CRITICO; READY_FOR_MERGE: NO; BLOCK_RELEASE: YES.

DIAGNOSTICO: commit 76d1860 resolveu a navegação de documento: CI 38931283647 passou pelos testes reais de GoTrue AAL2, retry idempotente, concorrência de abas e entrada no editor Chromium. A etapa seguinte falhou ao confirmar: o teste criava um lance livre convertido pela equipe B (codigo `1`) sem falta adversaria que concedesse LL. `validateSheet(document, true)` bloqueia isso com `LL convertidos excedem LL cobrados`, enquanto o rascunho pode ser salvo normalmente, explicando o status `Rascunho salvo no servidor` e a falta de confirmacao. O teste de dominio ja cobre esta regra; 30/30 PASS na verificacao focal.

CORRECAO_FOCAL: ajustar somente a fixture do navegador para duas cestas de campo validas (equipe A 3 pontos, B 2; total persistido esperado 5), mantendo as etapas de retry, conflito e recuperacao. Acrescentar diagnostico sem credenciais que, em eventual nova falha de confirmacao, registra alertas visiveis e respostas da API. `npm.cmd run check` PASS (68 arquivos/558 Vitest, formato, lint com 328 avisos nao bloqueantes, tipos, build, runbooks, agentes e scan de segredos). O navegador com GoTrue/PostgREST descartavel depende do job database do GitHub Actions; Docker nao instalado neste Windows. `worker-configuration.d.ts` alterado anteriormente pelo gerador permanece preservado e fora do commit. Nenhuma migration compartilhada, merge ou deploy de producao.

NOVO_CI: HEAD 2e171235285c8f6859a0a6082743b924aa4dd1d2, CI 38933401364, CodeQL 38933401378 e Preview 38933401374: gate/acessibilidade/CodeQL/Preview PASS; database FAIL somente no browser. O erro agora antecede a confirmacao: apos clicar `Iniciar transcrição`, o seletor `Camisa, B ou C` nao apareceu em 15 s (scripts/test-keyboard-disposable-browser.mjs:135/153). A razao ainda e desconhecida: pode ser erro de validacao de setup ou transicao de hidratacao. Foi adicionada captura de alertas, URL, estado do botao, corpo visivel e erros do navegador na falha do setup. O status anterior da confirmacao permanece sem replay nesta tentativa.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; SERVICO=GitHub Actions CI/database da PR77; ACAO=executar gate local antes do push, publicar o teste corrigido na branch PR77, verificar a confirmacao real no Chromium/GoTrue descartavel, atualizar REVIEW_PACKET com SHA e pareceres independentes; CRITERIO_DE_CONCLUSAO=CI/database/CodeQL/Preview verdes e revisoes criticas aprovadas no SHA final, sem liberar merge. Issue #84 permanece P2 para trabalho isolado apos #83.

## Issue #83 / PR #77 — navegação do fallback em stack descartável — 16/10/2026

WORK_UNIT: PR77-FALLBACK-RETRY-HISTORY-20261014; OWNER: project-maintainer; WRITE_LOCK: ACTIVE; BRANCH_LOCAL: codex/pr77-fallback-review-fixes-20261014; BRANCH_REMOTA: codex/keyboard-scoresheet-mvp; HEAD_INICIAL: dabafa879d4e6a8131527c844d3c143e6534d2ae; PR: OPEN/DRAFT; RISK_LEVEL: CRITICO; READY_FOR_MERGE: NO; BLOCK_RELEASE: YES.

DIAGNOSTICO: CI 38657876989, job database 116171995684: pgTAP, concorrência, GoTrue AAL2 e persistência passaram antes de Playwright falhar na navegação da seleção de jogos para `/admin/games/93501/scoresheet/keyboard`. O clique em `Link` aciona GET `.data` HTTP 200, com `href` correto; a URL permanece em `/admin/competitions/9350/scoresheets/new` durante o timeout de 5 s, sem erro reportado pelo console. GET de documento diretamente na rota de destino também retorna HTTP 200. A causa imediata é a transição client-side não concluída; a razão interna (resolução do módulo/tempo do React Router em dev) permanece sem telemetria conclusiva. O Chrome DevTools conectado ao preview PR77 mostra outro problema preexistente (`/admin/competitions.data` HTTP 500 por incompatibilidade com o banco compartilhado), que não reproduz a fixture descartável e não deve ser confundido com a falha do CI.

CORRECAO_FOCAL: o link `Iniciar fallback emergencial` usa `reloadDocument` somente nas edições com perfil FIBA; assim, abre a URL de documento diretamente e evita o mecanismo client-side `.data`. O loader e as verificações administrativas AAL2 permanecem no servidor. `npm.cmd test --` nas duas rotas: 23/23 PASS; `npm.cmd run check`: 68 arquivos/558 Vitest PASS, formato, lint (328 avisos), tipos, build, runbooks, agentes e scan de segredos PASS. O primeiro gate foi interrompido apenas pela falta de newline em `test-results/.last-run.json` ignorado, corrigida no artefato efêmero antes do gate verde. `worker-configuration.d.ts` permanece alterado pelo gerador e preservado fora do commit. Nenhuma migration ou operação de produção foi executada.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; SERVICO=branch remota da PR77, GitHub Actions CI/database e revisores; ACAO=publicar a correção focal, conferir navegação Chromium autenticada real em banco descartável e logs do job, atualizar REVIEW_PACKET e renovar pareceres independentes de banco/segurança, estatísticas, boxscore, acessibilidade e QA; CRITERIO_DE_CONCLUSAO=database/CI/CodeQL/preview verdes no SHA final, navegador AAL2 confirmando URL de destino, pareceres válidos sem REQUEST_CHANGES/BLOCK_RELEASE e PR mantida DRAFT até aprovação de release. Issue #84 é P2 posterior, com deadlock ainda não reproduzido.

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
## Issue #84 — correção reproduzida e revisada — 16/10/2026

WORK_UNIT=ISSUE84-BATCH-DEADLOCK-20261016; OWNER=project-maintainer; BRANCH=codex/issue84-batch-lock-order-20261016; PR=#87; HEAD_FUNCIONAL=5d90ad46fea7fa2284e2ef3e990efa77a63373f9; WRITE_LOCK=RELEASED; ESTADO=VALIDADO_SEM_MERGE_OU_ROLLOUT. Este checkpoint substitui o estado de execução anterior.

CI38989840825 SUCCESS (gate/accessibility/database); CodeQL38989840768 e preview38989840767 SUCCESS. Banco descartável:49arquivos/1350pgTAP; baseline reproduziu40P01 às01:16:15Z de17/10UTC (22:16 de16/10Brasília), correção sem40P01 às01:16:16Z. Duas requisições/ordens inversas retornam um sucesso/um erro de domínio explícito, uma temporada/duas disputas/um ledger/uma auditoria; retries preservamIDs; mesmoUUID e negação de anon/AAL1/não-admin continuam PASS. Gate512Vitest/66arquivos PASS. Banco6227858895 e QA na PR87 APPROVE_WITH_NON_BLOCKING_NOTES, semP0-P3, vinculados ao SHAfuncional. REVIEW_PACKET6227809498; registros remotos autoritativos na PR87 e issue84.

Limites: corridas mistas batch/helper/preset analisadas estaticamente; antecipar locks pode aumentar contenção. Evidência específica não certifica ausência universal de deadlocks. Nenhuma migration compartilhada, merge ou produção; não fechar issue antes da integração/rollout autorizado. Documento editorial posterior não muda o artefato funcional revisado.

PR86: banco6227803214 e acessibilidade6227803342 aprovados com notas; QA renovado encerrou BLOCK_RELEASE6227803485 após smokeAuth6227845306. Responsável realizou logout/login por senha; GoTrue logout204, token200, admissão200; consulta agregada confirmou nova sessão e zero admissões anteriores ao logout. Três pareceres válidos no funcionalfd0a91a. Sem alteração da PR77 nesta unidade.

PROXIMO_PASSO_EXATO: SERVICO=PRs86/87 e issue83/PR77; ACAO=conferir consolidação editorial e planejar ordem de integração/rollout em unidade autorizada; retomar pareceres críticos pendentes daPR77 em seu checkout preservado; CRITERIO=pareceres/gates do SHA correspondente e rollout explicitamente autorizado; não aplicar migrations compartilhadas nem integrar automaticamente.

## Issue #84 — correção de ordem dos locks — 16/10/2026

WORK_UNIT=ISSUE84-BATCH-DEADLOCK-20261016; OWNER=project-maintainer; BRANCH=codex/issue84-batch-lock-order-20261016; BASE=be851210da2ba96e4ca78c9cbfac53223ee6862d; WRITE_LOCK=ACTIVE (registro remoto issue84 comentário6221019141).

Retomada preserva os dois arquivos preparados anteriormente. Migration aditiva do wrapper batch mantém autorização, ledger e validação na função privada; adquire request434, campeonato432 quando novo e categorias433 únicas em ordem canônica antes de processar disputas. Preserva ordem do payload/IDs, AAL2, CAS, auditoria e replay. Teste CI descartável restaura wrapper original, exige deadlock40P01 com UUIDs/ordens inversas e barreira do ano, restaura correção no finally, verifica resultado explícito, atomicidade e IDs estáveis. Não executa em banco remoto. Causa ainda pendente de reprodução no banco descartável; não declarar resolvida antes da evidência.

PR86 está congelada em fd0a91a para renovação independente de banco/acessibilidade/QA; lista autenticada já validada por .data200 e sete tabelas. Worktrees alheias preservadas. Sem merge, migration compartilhada ou produção.

Gate local estável PASS: npm run check, 512 Vitest/66 arquivos, formato/lint/tipos/build/runbooks/agentes/segredos (734 arquivos; 328 avisos lint preexistentes). node --check e diff --check PASS. Três assertivas pgTAP adicionais cobrem disputes objeto/null/vazio e preservação de BD501. Docker indisponível no Windows; reprodução e SQL integral pendentes do CI descartável. Somente worker-configuration.d.ts regenerado nesta worktree foi identificado e retirado do delta após o gate, sem alteração do contrato de ambiente.

PROXIMO_PASSO_EXATO: ARQUIVO_OU_SERVICO=scripts/test-preset-concurrency.mjs e migration20261016173000; ACAO=finalizar regressões/gate local, abrir PR draft, comprovar baseline40P01 e correção no CI descartável e obter banco/QA independentes; CRITERIO=regressões, atomicidade/replay e pareceres válidos no SHA; sem rollout compartilhado.
## PR #86 — revisões finais e ciclo Auth verificados — 16/10/2026

WORK_UNIT=PREVIEW-PASSWORD-AUTH-FINAL-REVIEW; OWNER=project-maintainer; BRANCH=codex/preview-password-auth; HEAD_FUNCIONAL=fd0a91a076b473158b991601cfc68ea986ea61c8; WRITE_LOCK=RELEASED; ESTADO=REVISADO_SEM_MERGE. Substitui a pendência de revisão/smoke dos checkpoints anteriores.

Pareceres independentes publicados: banco6227803214 e acessibilidade6227803342 APPROVE_WITH_NON_BLOCKING_NOTES; QA renovado na PR86 encerrou explicitamente BLOCK_RELEASE6227803485 no mesmo SHA após evidência6227845306. CI38988812827 SUCCESS (541Vitest/70arquivos,1371pgTAP/50arquivos,17E2E/2skips); CodeQL38988812804 e preview38988812811 SUCCESS. Sem novo gate local ou alteração funcional nesta rodada.

Responsável realizou saída e novo login por senha. Logs: Cloudflare auth.logout success,correlation200a36b2-1f9b-4662-850a-df4be9b85e3b,17/10UTC01:13:28 (16/10Brasília22:13); Supabase logout204 às01:13:28.530Z; token200 às01:14:31.051Z; admin_open_preview_session200 às01:14:31.755Z. Consulta somente agregada confirmou uma admissão ligada à nova auth.session criada01:14:31.32883Z, zero órfãs e zero admissões anteriores ao logout. Não recuperados cookies, senha, tokens ou secrets. Lista/reload/filtro200/sete tabelas comprovados no smoke anterior. A aba temporária sem sessão foi fechada; nenhum login automatizado com credencial do responsável.

Limites preservados: correlação do loader após novo login não completada; smoke anterior da lista reutilizado. Não comprovadas todas as operações nem MFA real de produção. Notas herdadas de personalização mobile/foco permanecem; criação de edições depende da reconciliação separada das migrations. Nenhuma migration, merge ou deploy nesta rodada. PR permanece draft até integração explicitamente autorizada.

PROXIMO_PASSO_EXATO: SERVICO=PR86 e PR87; ACAO=conferir consolidação editorial e definir ordem de integração/rollout em unidade autorizada, preservando produção comMFA; CRITERIO=pareceres/gates válidos e compatibilidade verificada antes de qualquer rollout. PR87 resolve issue84 no CI; issue83/PR77 continua separada.

## Validação autenticada da compatibilidade do preview — 16/10/2026

WORK_UNIT=PREVIEW-COMPETITIONS-AUTH-SMOKE; OWNER=project-maintainer; BRANCH=codex/preview-password-auth; HEAD_FUNCIONAL=2dc0b4c94b1ad213eb6befcd039f104195310ac6; WRITE_LOCK=RELEASED; ESTADO=LISTA_AUTENTICADA_VERIFICADA.

Reconciliação: a correção de compatibilidade já estava commitada, publicada e com CI aprovado. O diagnóstico na conversa tratou registros anteriores ao deploy como pendência atual; não repetir rollback, implementação ou deploy. O Chromium do MCP chrome-devtools está sem sessão (about:blank); o navegador integrado possui a sessão real do responsável e foi utilizado para a validação, sem copiar cookies ou credenciais.

Evidência real: `/admin/competitions` renderizou sete tabelas de edições; recarregar preservou a lista. Clicar em Filtrar disparou GET `/admin/competitions.data?q=&year=&status=` com HTTP 200 e x-correlation-id `ba3443ae-f5bb-478b-8489-c9a7130e8fe9`; sete grupos permaneceram renderizados na URL com os filtros. O fallback para coluna ausente está em `app/routes/admin.competitions.tsx`, coberto pelos testes existentes para schema antigo, preferência atual e erros reais. CI 38927917551 (gate, accessibility, database), CodeQL 38927917538 e preview 38927917331 SUCCESS no SHA funcional. Evidências reutilizadas: nenhum código mudou nesta verificação.

Escopo desta rodada: documentação e smoke de leitura. Nenhuma migration, alteração de autenticação, merge, deploy ou suíte completa executada. A PR #86 permanece draft; este smoke não substitui as revisões pendentes de Auth nem comprova criação de edição, outras rotas ou o fallback da PR #77. Erros históricos de `team_registrations` não foram reproduzidos nem declarados corrigidos.

PROXIMO_PASSO_EXATO: SERVICO=PR #86; ACAO=renovar as revisões independentes de Auth no HEAD funcional e conferir os gates antes de eventual integração autorizada; CRITERIO=pareceres válidos, mantendo a evidência de lista autenticada. Reconciliação de migrations e issues #83/#84 continuam unidades separadas, sem aplicação no banco compartilhado.

## Compatibilidade da lista de competições no preview — 16/10/2026

WORK_UNIT=PREVIEW-COMPETITIONS-LEGACY-SCHEMA; BRANCH=codex/preview-password-auth; PR=#86; ESTADO=PREVIEW_DEPLOYED_PENDING_AUTH_SMOKE; WRITE_LOCK=RELEASED.

Falha observada no Chromium da PR #77: `/admin/competitions.data` retornou HTTP 500 (x-correlation-id `2a4d09fe-f9a7-4c8f-8497-f05729e36166`) e o ErrorBoundary exibiu "Algo saiu do compasso". O loader de `app/routes/admin.competitions.tsx` selecionava `competition_seasons.dispute_navigation_order`, coluna ausente no projeto Supabase compartilhado `yjnbemfeyjhxhomprlnm`. A migration de introdução `20261006123600_multi_dispute_creation_navigation.sql` consta localmente mas não foi registrada remotamente; há divergência histórica entre migrations locais/remotas, então não foi feito `db push`/`repair` em lote.

Correção focal no loader: se a consulta da preferência falhar exclusivamente com `42703`/`PGRST204`, consultar `competition_seasons.id` e apresentar a ordem padrão `category_division`. Em banco atualizado, preservar `dispute_navigation_order`; demais erros continuam fatais. Novo teste cobre fallback, preferência preservada e erros reais não mascarados. Gate local `npm run check` aprovado (541 Vitest/70 arquivos, lint com avisos preexistentes, typecheck, build, documentação, agentes, segredos). Sem alterações SQL, RLS, MFA ou PR #77.

Worker `base-do-basquete-preview` publicado apenas em preview com o segredo existente preservado: versão `4e6a91a3-14c8-4673-85e8-183828ab5ed0`. HTTP público após deploy: `/admin/login`=200, `/admin/competitions` sem sessão=302 para `/admin/login`. Não há smoke autenticado desta lista pelo navegador deste agente (o Chromium disponível está autenticado no hostname isolado da PR #77); não declarar a falha corrigida para sessão autenticada até que esse fluxo seja verificado. Produção não foi modificada.

PROXIMO_PASSO_EXATO: SERVICO=Worker base-do-basquete-preview e PR #86; ACAO=validar com sessão administrativa real `/admin/competitions` (lista deve carregar), resolver qualquer erro residual por correlação/logs, renovar pareceres independentes e conferir checks após push; CRITERIO=HTTP 200 autenticado com a lista renderizada e segurança AAL1/AAL2 preservada; manter PR #86 draft até gates/revisões válidos. A criação de novas disputas exige conciliar o restante das migrations em unidade separada antes de habilitá-la no banco compartilhado.

## Preview por senha publicado — 16/10/2026

WORK_UNIT=PREVIEW-PASSWORD-AUTH-ACTIVATE; BRANCH=codex/preview-password-auth; ESTADO=PREVIEW_DEPLOYED_PENDING_AUTH_SMOKE; WRITE_LOCK=RELEASED.

O responsável informou que o preview ainda pedia MFA. Diagnóstico remoto: o Worker ativo era de 14/10, e a página publicada de login ainda mostrava a instrução de segundo fator. PR #86 em 52038fd teve checks gate, database, accessibility, analyze e upload aprovados. Supabase compartilhado yjnbemfeyjhxhomprlnm confirmou migration 20261016130432 aplicada, uma linha de configuração privada e zero sessões admitidas. O hash armazenado foi comparado localmente com o segredo existente sem imprimir seus valores: correspondência positiva.

Build novo concluído e Worker `base-do-basquete-preview` publicado com `wrangler deploy --env preview --secrets-file tmp/preview-shared-secrets.json --keep-vars`, versão Cloudflare `1b9fd354-cb7c-4560-9603-d7f35c43205a`. Verificação HTTP pública posterior: `/admin/login` retorna 200 com instrução de acesso por e-mail/senha e sem texto de MFA; `/admin/mfa` sem cookie redireciona 302 para `/admin/login`; `wrangler secret list` confirma PREVIEW_AUTH_SECRET presente e os três segredos preexistentes mantidos. O formulário de produção ainda informa obrigatoriedade de segundo fator. Código local sem alterações adicionais além deste checkpoint; PR #77 não foi tocada.

PENDENCIAS: login real autenticado e operação administrativa em preview ainda não testados (credenciais do administrador não foram utilizadas); conferir em janela privada para evitar cookie/rota MFA anteriores. Renovação independente de banco, acessibilidade e QA no HEAD vigente ainda não ocorreu (tentativas anteriores de agentes encerraram por erro de conexão); PR #86 continua draft, sem integração na main. Nenhum deploy de produção realizado.

PROXIMO_PASSO_EXATO: SERVICO=preview Cloudflare e PR #86; ACAO=abrir `/admin/login` em janela privada e autenticar com a conta administrativa, validar leitura/escrita e proteção AAL1 normal, obter os três pareceres independentes finais e integrar a PR após os gates do HEAD; CRITERIO=login real por senha com acesso administrativo no preview, login AAL1 comum negado, produção com MFA real e pareceres válidos antes do merge.

## Ativação parcial do preview por senha — 16/10/2026

WORK_UNIT=PREVIEW-PASSWORD-AUTH-ACTIVATE; BRANCH=codex/preview-password-auth; ESTADO=ATIVACAO_PARCIAL; WRITE_LOCK=ACTIVE.

PR #86 no HEAD 55d09f9: checks `gate`, `database`, `accessibility`, `analyze` e `upload` aprovados; build local aprovado. Revisores independentes banco, acessibilidade e QA foram convocados para renovar os pareceres no HEAD, mas as três execuções terminaram com erro do transporte Codex (`stream disconnected before completion`), portanto não há parecer final válido.

Supabase compartilhado yjnbemfeyjhxhomprlnm: migration `20261016130432_preview_password_sessions.sql` aplicada em transação via `supabase db query --linked --project-ref` e versão `20261016130432` marcada como aplicada via `supabase migration repair`. Verificação remota: ambas as tabelas privadas presentes, zero linhas de configuração/segredo e zero sessões admitidas; a exceção permanece desativada. A tentativa de cadastrar o hash local foi bloqueada pelas configurações de segurança da OpenAI, portanto NÃO foi repetida por outra via. Worker preview não recebeu novo secret nem deploy nesta ativação. Produção não foi modificada. PR #77 permanece fora do escopo.

PROXIMO_PASSO_EXATO: SERVICO=Supabase compartilhado/Worker base-do-basquete-preview; ACAO=provisionar manualmente o hash do PREVIEW_AUTH_SECRET gerado em tmp/preview-shared-secrets.json na tabela private.preview_password_auth, publicar o Worker de preview com `--secrets-file`, validar login real e MFA da produção, obter pareceres independentes no HEAD e integrar PR #86 apenas após gates e smoke comprovados; CRITERIO=login por senha administrativo no preview, AAL1 comum recusado e produção exigindo MFA. Não reaplicar a migration já registrada.

## Ativação de preview autorizada — 16/10/2026

WORK_UNIT=PREVIEW-PASSWORD-AUTH-ACTIVATE; OWNER=project-maintainer; BRANCH=codex/preview-password-auth; HEAD_INICIAL=dc5bae6ff3c103ab5fcdf49e3a931dadaa9a05ac; WRITE_LOCK=ACTIVE; RISK_LEVEL=CRITICO.

DECISAO_VIGENTE_POSTERIOR: o responsável instruiu reutilizar o banco dos previews existentes e tornar o acesso por senha padrão para novas PRs, sem configuração por PR. Isso substitui o isolamento/blacklist da preparação anterior e autoriza alteração aditiva no Supabase compartilhado para esse fim. Não haverá novos projetos, cobrança nem pausa de QA72. A implementação deverá autorizar somente sessões explicitamente abertas pelo backend de preview mediante segredo próprio; AAL1 de login normal/produção continua rejeitado por RLS/RPCs, e o Worker de produção continua exigindo AAL2 real. É proibido simplesmente liberar AAL1 globalmente no helper. Configuração e segredo únicos no Worker preview serão herdados pelos previews futuros. Pareceres anteriores aprovam apenas o artefato isolado; renovar no novo delta antes de ativar.

Implementação vigente: migration aditiva 20261016130432_preview_password_sessions cria configuração privada por hash e admissões com FK para auth.sessions (revogação em cascade), TTL8h e RLS/grants sem acesso dos papéis de API. RPC admin_open_preview_session exige identidade administrativa, método password, sessão Auth real e capacidade de backend; o helper existente aceita somente essas sessões AAL1 além do AAL2 normal. Nada foi aplicado remotamente ainda. O overlay manual antigo e seus testes específicos foram removidos por incompatibilidade com o banco compartilhado. Wrangler declara PREVIEW_PASSWORD_AUTH=enabled somente em preview; PREVIEW_AUTH_SECRET será provisionado uma vez no Worker de preview. Cookie e validação AAL2 de produção preservados.

Evidências locais desse novo delta: npm run check PASS (536 Vitest/69 arquivos, tipos/build/formato/lint/agentes/runbooks e scan740); 24 testes focais de backend/configuração/login PASS; 24 pgTAP de sessões/capacidade/RLS/replay/TTL/logout/revogação PASS em PostgreSQL17 local com auth.sessions mínimo; baseline AAL2 10/10 PASS; Chromium/axe login 1/1 PASS. Tipo Worker regenerado porque a configuração agora declara novo binding; runtime gerado corresponde ao workerd já fixado no lockfile, sem alteração de dependências. Revisões e CI do novo delta ainda exigidos. PR draft criada: #86, https://github.com/renato-lucindo/base-do-basquete/pull/86; artefato antigo 365ddf4 teve CI/database/accessibility/CodeQL/preview verdes, sem aplicar a nova migration.

O responsável instruiu “faça os passos de ativação para mim”, autorizando o SQL e publicação necessários somente no preview. Esta instrução substitui a proibição anterior de ações remotas para esta ativação; produção, banco compartilhado e QA72 permanecem fora do escopo de alteração. O modo permanece opt-in por preview; nenhum preview existente será redirecionado indiscriminadamente. Não há identificador válido fornecido; list_projects e list_branches confirmam apenas compartilhado, QA72 e projeto antigo inativo. Procurar branch nova isolada, sem copiar dados. Custos que o provedor exigir devem ser confirmados pelo responsável no mecanismo oficial.

Histórico superado de provisionamento: create_branch(preview-password-auth) recusado pelo Supabase porque branching exige Pro. O responsável escolheu a organização renato-lucindo; create_project recusado pelo limite de dois projetos Free ativos. Nenhum recurso foi criado. A decisão posterior de reutilizar o banco existente encerrou esse caminho; não há pausa, cobrança, novo projeto ou escolha de quota pendente.

Cloudflare consultado em leitura: conta 16b4a5e0a99a031d28051ebadb4811cc; Worker preview modificado em 2026-10-15T00:05:09.914475Z, produção em 2026-09-25T18:09:37.411036Z. APP_ENV confirma preview/production, ambos com os três bindings criptografados esperados. Wrangler OAuth tem workers_scripts write; não é necessário novo login. Nenhum deploy/secret/configuração remota alterado. PR77 permanece dabafa879d4e6a8131527c844d3c143e6534d2ae OPEN/DRAFT.

Pareceres do novo mecanismo em 4643916: banco APPROVE_WITH_NON_BLOCKING_NOTES (2026-10-16T13:20:18Z), acessibilidade APPROVE_WITH_NON_BLOCKING_NOTES (13:22:05Z), QA REQUEST_CHANGES (13:19:22Z) por logout global em falha de admissão. Correção focal em andamento usa scope local nesse caminho para preservar outras sessões, com regressão observada falhar antes da alteração. CI38906452343, CodeQL38906452159 e Preview38906452236 PASS; SQL integral50 arquivos/1371 pgTAP PASS. Renovar pareceres focais após a correção. Limitação de foco herdada do formulário permanece documentada, sem mudança de CSS/interação neste delta.

PROXIMO_PASSO_EXATO: SERVICO=Supabase yjnbemfeyjhxhomprlnm e Worker base-do-basquete-preview; ACAO=validar correção de logout, renovar pareceres no SHA final, aplicar somente migration de sessões inicialmente desativada, provisionar capacidade/hash únicos e publicar preview; CRITERIO=login por senha e leitura/escrita real comprovados, outra sessão AAL1 negada e produção exigindo AAL2. Não há dependência de projeto novo.

## Acesso por senha somente em preview — 16/10/2026

WORK_UNIT=PREVIEW-PASSWORD-AUTH; OWNER=project-maintainer; BRANCH=codex/preview-password-auth; BASE_COMMIT=be851210da2ba96e4ca78c9cbfac53223ee6862d; WRITE_LOCK=ACTIVE; RISK_LEVEL=CRITICO.

O responsável solicitou acesso administrativo por senha e escolheu explicitamente **somente preview**. Esta instrução autoriza a exceção de produto nesse ambiente; produção continua exigindo MFA. Implementação em worktree própria, preservando os deltas existentes no checkout original e na PR #77. O HEAD remoto da PR77 observado foi dabafa879d4e6a8131527c844d3c143e6534d2ae, posterior ao checkpoint histórico abaixo.

Escopo simplificado por instrução posterior do responsável: opção explícita de Worker vinculada a projeto Supabase isolado e um overlay SQL manual, específico desse projeto, fora das migrations de produto. Sem tabela de configuração ou nova RPC. Testes de identidade/RLS/produção e instruções de ativação/rollback em docs/runbooks/preview-password-auth.md. Escopo negativo: nenhum uso do banco compartilhado yjnbemfeyjhxhomprlnm para senha sem MFA; não reutilizar o QA da PR72; não apagar fatores cadastrados; sem alteração da PR77, migrations remotas, merge ou deploy nesta preparação. A autorização anterior de investigação proíbe migrations remotas e deploy; a ativação será uma etapa concreta posterior.

REQUIRED_REVIEWERS=database-security-reviewer,accessibility-ui-reviewer,qa-reviewer. Em a7d3002, banco e QA emitiram APPROVE_WITH_NON_BLOCKING_NOTES somente para a preparação. Acessibilidade emitiu REQUEST_CHANGES por P2: selo herdado “Sessão AAL2” incompatível com o fluxo AAL1. WRITE_LOCK=ACTIVE para corrigir o selo e esclarecer as duas etapas do rollback; renovar pareceres focais após a correção. Esta unidade não resolve nem dispensa o bloqueio de navegação da PR77.

Implementação simplificada preparada: guard e login consultam a autorização existente do banco; a exceção só é selecionada pelo binding opcional do Worker com origem exata e projeto exclusivo. O overlay manual compila o emissor JWT e exige identidade administrativa, AAL1 explícito e método password; preserva o AAL real e a assinatura validada pelo Supabase. Sem binding, o backend mantém o fluxo original de MFA. Login e página de segurança informam o modo correto.

EVIDÊNCIAS LOCAIS: npm run check PASS (69 arquivos/544 Vitest, formato, lint com 328 avisos preexistentes, tipos, agentes, runbooks, build e scan de 740 arquivos). 32 regressões focais PASS; Chromium/axe do login 1/1 PASS. PostgreSQL 17 local descartável: baseline Auth/RLS 10/10 PASS, overlay 16/16 PASS, guardas de instalação para placeholder/compartilhado/QA72 PASS, rollback documentado PASS e baseline pós-rollback 10/10 PASS. Observadas falhas antes da implementação; corrigido retorno NULL para AAL ausente, que agora é false. Bootstrap Auth mínimo não valida GoTrue/PostgREST real nem todas as RPCs de domínio. Nenhuma evidência de acesso remoto por senha foi produzida.

PRESERVAÇÃO: gerador npm ci/typegen alterou worker-configuration.d.ts nesta worktree nova; somente esse delta gerado e identificado foi retirado. Nenhum arquivo do checkout original ou da PR77 foi alterado. Banco local foi usado somente para os testes descritos; Supabase compartilhado, QA72 e produção inalterados.

Correção focal posterior: selo global passou a “Sessão administrativa”, sem afirmar AAL2 em sessão AAL1. Runbook explicita conferência manual do projeto conectado e revogação completa primeiro no banco e depois no Worker. Gate após a correção PASS novamente: 544 Vitest, tipos/build/lint/formato/agentes/runbooks e scan740. O primeiro comando de formato desta rodada encontrou apenas o JSON efêmero do Playwright sem newline; corrigido esse artefato ignorado, sem modificar teste ou configuração. SQL e autenticação não mudaram nesta rodada. PostgreSQL descartável local foi parado após os ensaios.

Branch publicada em origin/codex/preview-password-auth, sem PR para não disparar automaticamente o workflow de preview. HEAD funcional publicado accc980bd7798afc6d8a4366ff090b18d05b2d9e, confirmado pela API GitHub e git ls-remote. Nenhum workflow remoto acionado. Falta identificador público válido de projeto exclusivo: a resposta recebida foi um nome curto, não uma referência Supabase de 20 letras; list_projects continua sem novo projeto dedicado. Foi solicitado o link do painel do projeto para evitar exigir que o responsável localize o identificador manualmente.

Renovações independentes em accc980: banco APPROVE em 2026-10-16T12:50:44Z; QA APPROVE em 12:50:45Z; acessibilidade APPROVE em 12:50:46Z. P2 do selo e notas de rollback/conferência de destino encerrados. Pareceres aprovam somente a preparação; não autorizam ativação, merge ou release. Acessibilidade anterior incluiu nove análises axe da renderização isolada em 390/720/1440, sem violações, além de inspeção de teclado; não equivale a login remoto/hidratação real. Revisores encerrados após emissão. Este checkpoint posterior é exclusivamente documental; artefato funcional e evidências não mudam.

```text
REVIEW_PACKET:
WORK_UNIT: PREVIEW-PASSWORD-AUTH
BRANCH: codex/preview-password-auth
BASE_COMMIT: be851210da2ba96e4ca78c9cbfac53223ee6862d
HEAD_COMMIT_FUNCIONAL: accc980bd7798afc6d8a4366ff090b18d05b2d9e
OBJETIVO: preparar acesso por senha somente em preview isolado, com ativação manual posterior
CRITERIOS_DE_ACEITE: default MFA; produção/compartilhado/QA72 rejeitados para exceção; identidade/emissor/senha/RLS validados localmente; UI correta; rollback documentado
ESCOPO: guard/configuração opcional, login/security/selo, testes, overlay manual e runbook
ESCOPO_NEGATIVO: remoto, PR77, compartilhado, QA72, produção, merge e deploy
ARQUIVOS_ALTERADOS: HANDOFF.md; app/env.d.ts; app/components/admin/admin-area.tsx; app/modules/auth/authorization.server.ts e teste; app/modules/auth/preview-password.server.ts e teste; app/routes/admin.login.tsx e teste; app/routes/admin.security.tsx; scripts/preview-password-auth.sql; preview-tests/preview_password_auth.test.sql; docs/runbooks/preview-password-auth.md
MIGRATIONS: nenhuma; overlay fora das migrations de produto
RISCOS_CONHECIDOS: destino depende de conferência manual; GoTrue/PostgREST/CI/operações de domínio e login remoto ainda não comprovados
TESTES_EXECUTADOS: check544, focal32, Chromium axe1, SQL baseline10/overlay16/rollback10 e guardas de instalação
EVIDENCIAS: logs locais citados acima e pareceres independentes no HEAD funcional; resultados essenciais preservados neste checkpoint
AMBIENTE_VALIDADO: local/Chromium/PostgreSQL17 com bootstrap Auth mínimo
RISK_LEVEL: CRITICO
RISK_JUSTIFICATION: Auth e autorização central de RLS/RPCs
REVIEW_DECISIONS: banco REQUIRED/APPROVE; acessibilidade REQUIRED/APPROVE; QA REQUIRED/APPROVE; estatística/boxscore/performance não aplicáveis ao delta
REQUIRED_REVIEWERS: database-security-reviewer, accessibility-ui-reviewer, qa-reviewer
WAIVERS: nenhuma dispensa crítica ou de gate de ativação
REVIEW_APPROVER: project-maintainer, somente preparação local
WRITE_LOCK_OWNER: RELEASED
READY_FOR_RELEASE: NO
```

PROXIMO_PASSO_EXATO: ARQUIVO_OU_SERVICO=projeto Supabase exclusivo de preview e docs/runbooks/preview-password-auth.md; ACAO=receber o link/identificador público válido, conferir isolamento/schema/conta administrativa e obter autorização específica para ativação remota; CRITERIO_DE_CONCLUSAO=login real por senha e leitura/escrita de dados de teste comprovados, produção continua MFA. ATIVACAO_REMOTA=NAO_REALIZADA; READY_FOR_RELEASE=NO. WRITE_LOCK=RELEASED.

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

## PR #77 — reconciliação do CI 893d3be — 14/10/2026

WORK_UNIT: PR77-FALLBACK-RETRY-HISTORY-20261014; OWNER: project-maintainer; WRITE_LOCK: ACTIVE; BRANCH_LOCAL: codex/pr77-fallback-review-fixes-20261014; BRANCH_REMOTA: codex/keyboard-scoresheet-mvp; HEAD_LOCAL_E_REMOTO: 893d3be42ec920261f3a5612ab25a6e7fe9e16c3; BASE_MAIN: be851210da2ba96e4ca78c9cbfac53223ee6862d; PR: OPEN/DRAFT; READY_FOR_MERGE: NO; BLOCK_RELEASE: YES.

CI 38656686277 no HEAD 893d3be: gate PASS, accessibility PASS, database FAIL somente na etapa Chromium de integracao autenticada; migrations descartaveis, pgTAP, concorrencia e PostgREST PASS. CodeQL 38656686267 PASS; Preview 38656686273 PASS. GoTrue/AAL2 autenticado PASS. Diagnostico real da falha: ao clicar Iniciar fallback emergencial na selecao de FIBA 9350, a pagina continua em /admin/competitions/9350/scoresheets/new apos 5 segundos; GET direto de /admin/games/93501/scoresheet/keyboard retorna status final 200, sem erros Javascript reportados. O status final 200 pode ocultar redirecionamentos; investigar eventos de navegacao e destino da resposta antes de atribuir causa. A descricao da PR ainda refere SHA f5c89b2 e devera ser atualizada com o SHA definitivo. Quatro pareceres anteriores REQUEST_CHANGES; renovacao de especialistas pendente. Arquivo worker-configuration.d.ts modificado por Wrangler preservado, fora de commits. Nenhum merge, deploy de producao ou migration compartilhada.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=scripts/test-keyboard-disposable-browser.mjs + Actions CI PR #77; ACAO=instrumentar rastreio de requests e redirects ao clicar no link FIBA, publicar commit de diagnostico, analisar falha real, corrigir e repetir ate completar teste; depois atualizar REVIEW_PACKET e renovar revisoes independentes; CRITERIO_DE_CONCLUSAO=Chromium end-to-end completo + CI/CodeQL/Preview verdes no mesmo HEAD, pareceres criticos validos, PR permanece DRAFT sem merge/producao.

## PR #77 — CI do diagnostico eb768e5 e formato — 14/10/2026

No commit eb768e5 o GitHub Actions CI 38657432207 iniciou; o job gate falhou em format:check porque Biome exige quebrar em multiplas linhas o objeto navigationEvents.push no evento requestfailed; ajuste focal aplicado, node --check e git diff --check PASS. Accessibility 35 passed, 2 skipped no ciclo observado. Job database permanecia em progresso na ultima observacao, sem conclusao verificada. Monitoramento posterior por ferramenta foi bloqueado pela plataforma; consultar resultado e diagnostico real antes de atribuir causa ao loader ou hidratacao. Manter READY_FOR_MERGE=NO, BLOCK_RELEASE=YES, WRITE_LOCK=ACTIVE. Preservar worker-configuration.d.ts.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=CI GitHub Actions PR77 (run 38657432207), scripts/test-keyboard-disposable-browser.mjs; ACAO=confirmar o diagnostico de navegacao e redirecionamento quando o job terminar, corrigir a causa demonstrada e executar integracao Chromium real com CI no mesmo SHA; CRITERIO_DE_CONCLUSAO=fluxo autenticado completo comprovado e pareceres independentes atualizados.
