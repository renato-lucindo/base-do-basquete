# Reconciliação operacional de migrations — Etapa 4 / PR #72

Data do diagnóstico: 08/10/2026. Projeto: `yjnbemfeyjhxhomprlnm`. Branch-base: `codex/manual-scoresheet-v2@7781486`.

A comparação read-only entre `supabase_migrations.schema_migrations` e `supabase/migrations` encontrou **62** versões remotas e **69** arquivos locais. Dos 59 nomes comuns, **56** têm SQL normalizado idêntico, **2** diferem e **1** tem histórico remoto sem `statements`. Há **3** versões exclusivamente remotas e **10** arquivos exclusivamente locais (6 históricos e 4 da súmula manual v2 ainda pendentes).

- Versões somente remotas: `20260831133611_player_profile_foundation_compat`, `20261005140439_season_division_model`, `20261005140504_edition_creation_workflow`.
- Diferença funcional de histórico: `canonical_model` possui índices adicionais e policies com papéis diferentes no arquivo local em relação ao SQL registrado no remoto. Não substituir silenciosamente nenhuma versão histórica.
- Diferença de formatação: `basketball_site_boxscore` registra o mesmo `RAISE EXCEPTION` com quebra de linha diferente.
- Sem SQL armazenado no histórico remoto: `wp14_import_team_stats_assisted_players`.
- Arquivos locais sem versão remota: `single_admin_auth`, `player_profile_foundation`, `mvp01_structural_foundation`, `mvp01_existing_game_ingestion`, `mvp01_matchup_enforcement`, `mvp02_public_player_read_models` e as quatro migrations da Etapa 4.

## Solução operacional sem reparar o banco compartilhado

Execute `node scripts/supabase-stage4-reconcile-overlay.mjs` na raiz do repositório. O script cria, em uma pasta temporária, um projeto Supabase com **62 filenames alinhados exatamente às versões já registradas remotamente** e as **quatro migrations de Etapa 4**. Os três arquivos remotos sem correspondente local recebem marcadores que falham se indevidamente executados em um banco novo.

Use **somente** o comando `db push --dry-run` impresso pelo script e confirme que a prévia propõe apenas as quatro migrations da Etapa 4. `--workdir` é uma flag global documentada do CLI. O script exige o project ref específico e para de executar se surgirem arquivos locais inesperados.

Esta solução permite inspecionar o plano de upgrade da Etapa 4 sem alterar versões históricas, nem alterar dados/policies/migrations do Supabase. **Ela não reconcilia permanentemente o repositório para bootstrap de um banco novo.** A reconciliação histórica definitiva requer comparação e testes SQL desde zero, revisão das diferenças em `canonical_model` e dos seis arquivos locais sem registro remoto. Não executar `migration repair --status reverted` em massa.

## Evidências e pendências

- Histórico remoto consultado via plugin Supabase em 08/10/2026; nenhum DDL/DML/repair executado.
- SQL comparado com arquivos GitHub na branch da PR #72.
- Dados do snapshot em `docs/execution/supabase-stage4-remote-migration-history.json`.
- Overlay gerado no worktree Windows do usuário. O `db push --dry-run` retornou **somente as quatro migrations da Etapa 4**, sem escrever no banco.
- As quatro migrations foram aplicadas **somente no PostgreSQL descartável do GitHub Actions**, com pgTAP **45 arquivos / 1.220 testes PASS** (CI run [37819623694](https://github.com/renato-lucindo/base-do-basquete/actions/runs/37819623694), commit `2992c7bc`). O gate, acessibilidade, CodeQL e preview também passaram. O banco remoto permaneceu com 62 versões aplicadas e nenhuma dessas quatro. Pareceres especializados e QA final ainda pendentes. A aplicação em um clone fiel da baseline remota não foi testada.
- Não iniciar Etapa 5.

**Próximo passo exato:** validar upgrade sobre um clone representativo da baseline remota divergente e obter revisões especializadas de banco/estatística/QA para Etapa 4. Não efetuar `repair`, deploy nem merge no Supabase compartilhado sem gate e autorização apropriados.
