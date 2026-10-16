# HANDOFF — Base do Basquete

## Acesso por senha somente em preview — 16/10/2026

WORK_UNIT=PREVIEW-PASSWORD-AUTH; OWNER=project-maintainer; BRANCH=codex/preview-password-auth; BASE_COMMIT=be851210da2ba96e4ca78c9cbfac53223ee6862d; WRITE_LOCK=ACTIVE; RISK_LEVEL=CRITICO.

O responsável solicitou acesso administrativo por senha e escolheu explicitamente **somente preview**. Esta instrução autoriza a exceção de produto nesse ambiente; produção continua exigindo MFA. Implementação em worktree própria, preservando os deltas existentes no checkout original e na PR #77. O HEAD remoto da PR77 observado foi dabafa879d4e6a8131527c844d3c143e6534d2ae, posterior ao checkpoint histórico abaixo.

Escopo simplificado por instrução posterior do responsável: opção explícita de Worker vinculada a projeto Supabase isolado e um overlay SQL manual, específico desse projeto, fora das migrations de produto. Sem tabela de configuração ou nova RPC. Testes de identidade/RLS/produção e instruções de ativação/rollback em docs/runbooks/preview-password-auth.md. Escopo negativo: nenhum uso do banco compartilhado yjnbemfeyjhxhomprlnm para senha sem MFA; não reutilizar o QA da PR72; não apagar fatores cadastrados; sem alteração da PR77, migrations remotas, merge ou deploy nesta preparação. A autorização anterior de investigação proíbe migrations remotas e deploy; a ativação será uma etapa concreta posterior.

REQUIRED_REVIEWERS=database-security-reviewer,accessibility-ui-reviewer,qa-reviewer. Em a7d3002, banco e QA emitiram APPROVE_WITH_NON_BLOCKING_NOTES somente para a preparação. Acessibilidade emitiu REQUEST_CHANGES por P2: selo herdado “Sessão AAL2” incompatível com o fluxo AAL1. WRITE_LOCK=ACTIVE para corrigir o selo e esclarecer as duas etapas do rollback; renovar pareceres focais após a correção. Esta unidade não resolve nem dispensa o bloqueio de navegação da PR77.

Implementação simplificada preparada: guard e login consultam a autorização existente do banco; a exceção só é selecionada pelo binding opcional do Worker com origem exata e projeto exclusivo. O overlay manual compila o emissor JWT e exige identidade administrativa, AAL1 explícito e método password; preserva o AAL real e a assinatura validada pelo Supabase. Sem binding, o backend mantém o fluxo original de MFA. Login e página de segurança informam o modo correto.

EVIDÊNCIAS LOCAIS: npm run check PASS (69 arquivos/544 Vitest, formato, lint com 328 avisos preexistentes, tipos, agentes, runbooks, build e scan de 740 arquivos). 32 regressões focais PASS; Chromium/axe do login 1/1 PASS. PostgreSQL 17 local descartável: baseline Auth/RLS 10/10 PASS, overlay 16/16 PASS, guardas de instalação para placeholder/compartilhado/QA72 PASS, rollback documentado PASS e baseline pós-rollback 10/10 PASS. Observadas falhas antes da implementação; corrigido retorno NULL para AAL ausente, que agora é false. Bootstrap Auth mínimo não valida GoTrue/PostgREST real nem todas as RPCs de domínio. Nenhuma evidência de acesso remoto por senha foi produzida.

PRESERVAÇÃO: gerador npm ci/typegen alterou worker-configuration.d.ts nesta worktree nova; somente esse delta gerado e identificado foi retirado. Nenhum arquivo do checkout original ou da PR77 foi alterado. Banco local foi usado somente para os testes descritos; Supabase compartilhado, QA72 e produção inalterados.

Correção focal posterior: selo global passou a “Sessão administrativa”, sem afirmar AAL2 em sessão AAL1. Runbook explicita conferência manual do projeto conectado e revogação completa primeiro no banco e depois no Worker. Gate após a correção PASS novamente: 544 Vitest, tipos/build/lint/formato/agentes/runbooks e scan740. O primeiro comando de formato desta rodada encontrou apenas o JSON efêmero do Playwright sem newline; corrigido esse artefato ignorado, sem modificar teste ou configuração. SQL e autenticação não mudaram nesta rodada. PostgreSQL descartável local foi parado após os ensaios.

Branch publicada em origin/codex/preview-password-auth, sem PR para não disparar automaticamente o workflow de preview. Referência do primeiro push a7d30025832d79ccfa5fd1c2088d098a306a0c9c. Nenhum workflow remoto acionado. Renovação focal dos pareceres após a correção do selo ainda pendente. Falta identificador público válido de projeto exclusivo: a resposta recebida foi um nome curto, não uma referência Supabase de 20 letras; list_projects continua sem novo projeto dedicado.

PROXIMO_PASSO_EXATO: ARQUIVO_OU_SERVICO=branch codex/preview-password-auth e docs/runbooks/preview-password-auth.md; ACAO=consolidar a renovação focal dos pareceres, depois receber o identificador público de um projeto exclusivo de preview e autorização específica para ativação remota; CRITERIO_DE_CONCLUSAO=login real por senha e leitura/escrita de dados de teste comprovados, produção continua MFA. ATIVACAO_REMOTA=NAO_REALIZADA; READY_FOR_RELEASE=NO. WRITE_LOCK=RELEASED para revisão.

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

