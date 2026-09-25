# STATS-04 — Rollout e fechamento

## Estado

Em andamento na PR draft #53. Os read models anteriores continuam presentes e o carregador mantém fallback explícito quando uma publicação atual ainda não possui snapshot estatístico.

A primeira inspeção da prévia encontrou que o PostgREST sem a migration devolvia `PGRST205` e acionava o error boundary. O carregador passou a tratar exclusivamente schema ausente (`PGRST205`/`42P01`) como rollout anterior; erros de autorização ou consulta continuam bloqueantes. O gate local foi repetido após a correção: 49 arquivos/342 testes, TypeScript, build, cinco runbooks e scan de 622 arquivos aprovados.

No HEAD funcional `8e2fa01`, os quatro checks remotos passaram: `gate` em 50 s, `database` desde zero/pgTAP integral em 2 min 17 s, `upload` com smoke em 1 min 24 s e CodeQL em 3 min 8 s. A prévia `pr-53-base-do-basquete-preview` confirmou o fallback legado sem erro e sem overflow global em 320, 390, 768 e 1440 px; a tabela manteve overflow próprio e `tabindex=0`. O override de viewport foi restaurado.

A interface `boxscore-v2` não pode ser exercitada nessa prévia antes da migration existir no Supabase compartilhado. Aplicá-la continua fora da autorização desta unidade; portanto, a validação visual do novo componente permanece pendente e não é substituída pela confirmação do fallback.

O primeiro parecer QA no HEAD `4c0cb55` foi `BLOCK_RELEASE`: apontou base completa incorreta no review packet, ausência inevitável de QA real da UI, ausência do parecer especializado de banco e teste de troca de autoridade apenas estrutural. A base foi reconciliada para `fe642353992f50079233d5c39c6adb8ec6da142b`; a fixture FIBA agora troca efetivamente para uma submissão sem FR, comprova limpeza do `game_total`, preserva uma linha de período e restaura/reprojeta a autoridade FIBA. Os bloqueios externo e visual permanecem declarados.

No HEAD `3c71324`, gate, banco desde zero/pgTAP integral, preview/smokes e CodeQL passaram. A revisão QA incremental de 2026-09-22 12:39 -03:00 confirmou como resolvidos o hash da base e o teste comportamental, mas manteve `BLOCK_RELEASE` por dois gates externos: parecer obrigatório do `database-security-reviewer` indisponível nesta sessão e QA real da UI dependente de migration não autorizada. A PR permanece draft por desenho.

O primeiro commit exclusivamente documental do parecer chegou à branch remota como `9041652`, mas a API da PR permaneceu temporariamente indexada no pai funcional `3c71324`. Essa divergência de identidade também bloqueia o gate até a referência da PR acompanhar a branch, sem reescrita de histórico.

## Gate pendente

Atualização 22/09 após autorização: migration STATS aplicada ao projeto `yjnbemfeyjhxhomprlnm` como `20260922161633_stats_public_player_snapshot` (arquivo local `20260922141453_stats_public_player_snapshot.sql`). Ensaio DDL em rollback e 20/20 pgTAP focais pós-aplicação aprovados; 74 linhas preservadas, 42 com FR. A referência da PR já acompanha `50a76fa`. Tipos das novas tabelas reconciliados com o schema real, sem remover campos das migrations locais pendentes.

A autorização e aplicação do item 3 abaixo estão cumpridas. A interface permanece no fallback porque não há snapshot: competição 20/publicação 2 possui hash editorial inalterado, mas `starts_on=NULL` impede republicação (`START_DATE_REQUIRED`). Aguardar data correta do responsável; não inventar data nem contornar o gate administrativo. A migration anterior Basketball Site ainda está ausente no banco compartilhado e precisa ser reconciliada antes do QA daquele formato. Parecer especializado continua indisponível. Nenhum merge/deploy da aplicação em produção realizado.

Gate local após reconciliação de tipos: formatação, TypeScript, 342 testes/49 arquivos, cinco runbooks, build e scan de 622 arquivos aprovados; lint com 151 avisos e zero erro. A primeira tentativa parou por `spawn EPERM` do sandbox; a execução autorizada fora dele passou. Tipos de campos locais da migration Basketball Site foram preservados: regenerar cegamente pelo remoto os removeria indevidamente.

Smoke público pós-migration: `node scripts/smoke-public-context.mjs https://pr-53-base-do-basquete-preview.renato-lucindo-jr.workers.dev` aprovado. Confirma disponibilidade do fallback; não substitui QA da interface nova.

O responsável definiu `2026-09-01` como data de início da fixture FIBA. A atualização remota foi aplicada com comparação do valor anterior nulo e validada: competição 20 sem bloqueadores, `canPublish=true`, `changed=true`, versão pública atual 1. A publicação da versão 2 ainda não ocorreu porque a prévia exige login e MFA do responsável; a tela administrativa foi deixada aberta no login.

Após login/MFA, o responsável confirmou a versão 2 pelo fluxo administrativo. Reconciliação: publicação atual 11, contrato `boxscore` schema 1, 35 linhas `all`, nenhuma linha `regular`/`playoffs` e dois jogos `unclassified`, coerente com a ausência de etapa estrutural nas fixtures. QA real aprovou renderização de 35 atletas, paginação, totais, modo por 30 minutos e seu aviso de cobertura; fase regular apresentou estado vazio explícito. A aba entregue ao responsável ficou em total/`all`. Restam os viewports, teclado/zoom/comparação e o formato Basketball Site pendente da migration anterior ausente no compartilhado.

1. obter parecer do `database-security-reviewer` para STATS-01/STATS-02;
2. obter parecer do `qa-reviewer` no mesmo commit;
3. obter autorização explícita para aplicar a migration no Supabase compartilhado;
4. regenerar tipos a partir do schema aplicado e validar a interface nova com FIBA/Genius, Basketball Site, cobertura parcial, teclado, acessibilidade e larguras 320, 390, 768 e 1440 px;
5. manter a PR draft e não integrar nem publicar produção sem autorização explícita.


## Atualização de fechamento — 25/09/2026

A branch da PR #53 foi reconciliada sem reescrita de histórico com `origin/main@c09e72a` no commit `3760a4f`. A reconciliação incorporou a correção da PR #57 e a migration Basketball Site já aplicada no compartilhado como `20260925180553_basketball_site_boxscore`; a migration STATS continua a mesma já persistida como `20260922161633_stats_public_player_snapshot` e não foi reaplicada.

Gate local no estado reconciliado: `git diff --check`, `npm ci` com zero vulnerabilidades, `npm run check` com 51 arquivos/373 Vitest, TypeScript, cinco runbooks, build e scan de 637 arquivos; lint sem erros e 237 warnings. O E2E Playwright+axe passou 1/1 em Chromium. No mesmo HEAD funcional, GitHub aprovou `gate`, `database`, `accessibility`, preview/upload e CodeQL.

O preview `pr-53-base-do-basquete-preview` passou o smoke público. A rota `/2026/copa-es-ouro/fixture-fiba/masculino/jogadores?scope=all&mode=total` renderizou o `boxscore-v2` em 320, 390, 768 e 1440 px com HTTP 200, 20 linhas na primeira página, sem overflow global, sem erro de console, filtro `<details>/<summary>` operável por teclado e Escape e comparação abrindo/fechando corretamente. O aviso de cobertura informou dois jogos sem fase definida, coerente com o snapshot publicado.

O bloqueio anterior da migration Basketball Site está resolvido pela reconciliação da PR #57. Permanecem obrigatórios, antes de qualquer merge, pareceres independentes de `database-security-reviewer` e `qa-reviewer` no mesmo HEAD. A tentativa desta sessão de iniciar um reviewer separado via executor local foi recusada pela política do executor antes de qualquer revisão; nenhum parecer foi simulado. A PR permanece draft, sem merge e sem deploy de produção.
