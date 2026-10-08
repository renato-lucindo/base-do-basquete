# Súmula manual v2 — execução e revisão automatizada da Etapa 4

**Data:** 2026-10-08. **WORK_UNIT:** MANUAL-SCORESHEET-V2-FIBA2024. **PR:** [#72](https://github.com/renato-lucindo/base-do-basquete/pull/72). **Base:** `8ac62209a636be757d96270eef9dc6b27c8735c0`.

## Protocolo de teste sem custo adicional do Supabase

O workflow [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) executa um PostgreSQL descartável do GitHub Actions. Não há autenticação contra o Supabase remoto, não existe replicação de dados de usuários, e nenhuma migration remota é aplicada. O job padrão `database` sobe as migrations locais do zero e executa todos os testes pgTAP. O job adicional `remote_history_upgrade` somente inicia após o primeiro, para não compartilhar portas.

`scripts/test-stage4-remote-history-upgrade.mjs` monta o segundo ambiente temporário a partir de **62 versões** registradas no Supabase remoto `yjnbemfeyjhxhomprlnm`, usando o SQL remoto original para `canonical_model`, `basketball_site_boxscore`, `player_profile_foundation_compat`, `season_division_model` e `edition_creation_workflow`. As demais versões com SQL idêntico usam os arquivos versionados. **Cinco migrations locais de bootstrap sem registro remoto** são mantidas para permitir reconstrução a partir de banco vazio. O SQL da versão `wp14_import_team_stats_assisted_players` não foi armazenado no histórico remoto: seu arquivo local é utilizado como aproximação. Portanto, isto reproduz **uma baseline representativa de migrations, não um dump exato da estrutura ou dos dados de produção**.

Depois de subir essa baseline sem o seed demonstrativo, o GitHub Actions aplica separadamente as quatro migrations da Etapa 4 usando `supabase migration up` e roda **nove suítes focais**: as quatro de súmula manual v2, `manual_scoresheet_transactions`, `fiba_boxscore_import`, `basketball_site_boxscore`, `game_data_domain_authority` e `stats_public_player_snapshot`. A suíte padrão de 45 arquivos continua obrigatória no job `database`.

## Evidências efetivamente obtidas

- Dry-run remoto previamente executado no Windows do usuário: somente quatro migrations da Etapa 4 propostas; nenhuma mudança aplicada.
- [CI 37831964915](https://github.com/renato-lucindo/base-do-basquete/actions/runs/37831964915), commit `4daaf788`: **45 arquivos pgTAP / 1.228 asserções passaram** no banco descartável local; `gate` e `accessibility` aprovados.
- Nesse mesmo run, a baseline histórica **subiu**, as quatro migrations de Etapa 4 **foram aplicadas**, e as **nove suítes focais relevantes passaram**. O resultado agregado daquele job foi negativo porque outros testes exigiam seed de demonstração ou constraints do modelo legado; por isso o job foi limitado explicitamente às nove suítes. Não confundir o êxito focal com aprovação do job completo.
- Correções de segurança/estatística incorporadas: política RLS de leitura pública separada de admin AAL2; projeção coletiva inicial na criação; rejeição transacional `BD225` quando LL convertidos excedem os concedidos; vista legada pública com tentativas de arremesso `NULL` em jogos manuais; boxscores FIBA preservados.
- A execução subsequente ao ajuste de escopo e formatação precisa estar **verde no HEAD efetivo** antes de fechar o gate. Não registrar aprovação antecipada.

## Análise técnica (autoauditoria; não substitui revisores independentes)

**Segurança:** RPC de criação/revisão exige admin AAL2; revokes impedem execução anônima; snapshots e metadados internos usam RLS forçado; a projeção pública depende da publicação do jogo. Um teste real de role `anon` identificou erro ao avaliar a função de admin dentro da política pública, corrigido por políticas separadas. Testes de role anônimo/não-admin/admin estão em pgTAP. Não houve inspeção com dados de produção.

**Domínio estatístico:** FIBA continua sendo a autoridade para tentativas importadas. Em súmulas manuais, as tentativas individuais não podem ser inferidas de conversões; o read model legado mascara esses campos e a projeção nova informa somente LL coletivos concedidos, cobrados, convertidos, desperdiçados e percentual. Percentuais com denominador zero são `NULL`. O caso impossível (convertidos acima dos concedidos) é recusado e sua transação desfeita.

**QA:** suíte padrão contempla migração desde zero, rollback, idempotência, seis autoridades de domínio, revisões concorrentes, permissões, FIBA, build/typecheck/lint e testes E2E. O caminho de histórico remoto reconstrói a baseline estrutural sem dados reais. A situação final é **tecnicamente testada em CI, mas não homologada em clone completo do banco remoto**.

## Riscos e bloqueios remanescentes

1. Reconciliar definitivamente os timestamps e migrações locais/sem histórico, e obter comparação da estrutura remota quando houver ambiente seguro; o teste atual não prova igualdade byte a byte de toda a base.
2. Os agentes `database-security-reviewer`, `statistics-domain-reviewer` e `qa-reviewer` precisam emitir **pareceres independentes válidos** conforme `.agents/agent-contract.md`; esta autoauditoria não preenche esse requisito nem revoga automaticamente o BLOCK_RELEASE estatístico anterior.
3. Preservar WIP do worktree Windows; não usar `git reset`, `migration repair` global, `db push` compartilhado, merge ou Etapa 5 sem autorização e gates.

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: PR #72, GitHub Actions remote_history_upgrade, .agents/{database-security-reviewer,statistics-domain-reviewer,qa-reviewer}.md
ACAO: conferir gate verde no HEAD efetivo, obter pareceres independentes sobre as correções e manter o banco compartilhado intocado até aprovação.
CRITERIO_DE_CONCLUSAO: CI completo verde, revisores válidos, HANDOFF coerente com Git, sem perda de WIP nem deploy em produção.
```
