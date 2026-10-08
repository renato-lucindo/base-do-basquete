# Etapa 4 — pré-análise em ordem e solicitação de pareceres independentes
Data: 2026-10-08 · Unidade: `MANUAL-SCORESHEET-V2-FIBA2024` · PR #72.

**Natureza deste documento:** pré-análise técnica e encaminhamento do maintainer. **NÃO é** parecer emitido por `database-security-reviewer`, `statistics-domain-reviewer`, `accessibility-ui-reviewer`, `boxscore-domain-reviewer` ou `qa-reviewer`. De acordo com `.agents/agent-contract.md`, somente aqueles agentes efetivamente acionados podem emitir parecer independente. Não converter resultados verdes de CI em APPROVE fictício.

## Identidade e evidências
- `BASE_COMMIT=8ac62209a636be757d96270eef9dc6b27c8735c0`; código testado em `badb8ddf3b075e4cd228a757b5d6830fb6136ec6` com documentação até `c6639dd93bb3e1c87a9c7a51c328c37f3a3ee780`.
- CI `37832981246` SUCCESS: `gate`, `accessibility`, `database`, `remote_history_upgrade`; pgTAP 45 arquivos/1.228 testes no bootstrap e 9 arquivos/314 no upgrade reconstruído.
- CodeQL `37832981226` e preview `37832981113` SUCCESS; verificação de código e artefatos é do commit funcional, delta documental posterior não altera a implementação.
- GitHub PR #72 está `draft`, `mergeable_state=dirty` e não possui reviews submetidos nem revisores GitHub designados (leitura em 08/10). `main` atual `59fb0eeb7a9f99491e8b913dc9265a4f08ecb184`, avançada após a base da PR.
- Não foi possível executar `git status` do worktree Windows por meio deste conector; preservar WIP, evitar reset/pull forçado e conferir status local antes de qualquer reconciliação.
- Projeto Supabase remoto `yjnbemfeyjhxhomprlnm`: 62 migrations aplicadas, última `20261005140504`; zero das quatro migrations de Etapa 4 aplicadas. Apenas consultas read-only.

## 1. Pré-análise de segurança de banco — aguarda `database-security-reviewer`
- Inspecionadas quatro migrations da PR: políticas RLS e GRANT/REVOKE para metadados, payloads, revisões e projeção; RPCs `admin_create_manual_scoresheet_v2` e `admin_revise_manual_scoresheet_v2` com autorização admin AAL2, advisory locks, CAS, rollback e auditoria.
- O teste de role `anon` revelou anteriormente avaliação indevida da função administrativa na projeção, corrigida com policies separadas; os testes da mudança passaram no CI descartável. `security_invoker=true` preservado na atualização de `game_player_statistics`.
- Remote advisors: 11 avisos informativos de tabelas `private` sem policies, 51 avisos de RPCs `SECURITY DEFINER` executáveis pelo papel autenticado, e 1 aviso de proteção contra senhas comprometidas. São **avisos da baseline remota anterior à Etapa 4**, não prova de falha introduzida pela PR; revisar as RPCs efetivas por autorização interna. Referências: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy e https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable.
- Risco residual P1 de release: upgrade testado contra baseline reconstruída (não dump exato; SQL faltante em um registro histórico e versões divergentes); antes de produção exigir reconciliação/parecer formal. **Resultado:** PRONTA PARA REVISÃO INDEPENDENTE, não APPROVE.

## 2. Pré-análise de estatísticas — aguarda `statistics-domain-reviewer`
- Examinadas fórmulas de `private.manual_scoresheet_v2_collective_ft_summary`, validadores e `public.game_player_statistics`. LL concedidos ao adversário definem cobrança do time; convertido e desperdício são agregados por lado; percentual usa denominador efetivo, retornando `NULL` quando zero. Conversões maiores que cobranças geram `BD225` e rollback.
- Tentativas de arremesso individuais artificiais são mascaradas na view genérica quando `game.source='manual'`; estatísticas completas FIBA seguem sua autoridade específica. Teste de mascaramento e nove suítes focais aprovados na baseline reconstruída.
- **P2 / caso-limite para avaliação formal:** `game.source` registra a origem do jogo, não necessariamente a autoridade estatística ativa. Se um jogo de origem `manual` receber posteriormente uma fonte FIBA avançada, a view genérica poderá mascarar tentativas reais. A consulta agregada ao remoto atual encontrou zero jogos nessa combinação (não comprova todos os cenários futuros). Recomenda-se confirmar se o guard deve usar `game_data_domain_authority` / domínio `player_advanced` em vez da origem.
- O `BLOCK_RELEASE` anterior do revisor estatístico **não foi formalmente revogado**. **Resultado:** REVISÃO INDEPENDENTE PENDENTE, não APPROVE.

## 3. Pré-análise de QA e integração — aguarda revisores
- QA automático verde (tipagem, lint, testes, build, acessibilidade, pgTAP e concorrência); não substitui inspeção por agentes do contrato.
- **P1 de integração:** GitHub reporta `mergeable_state=dirty` para a PR #72 contra a `main` atual. Arquivos alterados por ambos: `.github/workflows/ci.yml`, `HANDOFF.md` e `app/types/database.generated.ts`. Resolver conflitos preservando mudanças de ambas as branches e WIP local; após qualquer mudança material executar novamente os gates e renovar pareceres.
- `accessibility-ui-reviewer` é exigido pelo plano para mudanças materiais na PR; `boxscore-domain-reviewer` deve ser avaliado no escopo da atualização da view legada (não houve alteração nos contratos de importação PDF).
- **Resultado:** QA FINAL BLOQUEADO por ausência dos pareceres independentes prévios e por conflitos de integração.

## 4. Estado e próximo passo
**ETAPA 4: EM REVISÃO / NÃO ENCERRADA.** Não fazer merge, deploy, `db push`, `migration repair`, produção ou Etapa 5. Nenhuma ação no banco compartilhado foi realizada. Esta pré-análise não altera nem anula o bloqueio estatístico anterior.

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer / execução de agentes Codex com seus próprios contextos
ARQUIVO_OU_SERVICO: PR #72; .agents/database-security-reviewer.md; .agents/statistics-domain-reviewer.md; .agents/accessibility-ui-reviewer.md; .agents/qa-reviewer.md
ACAO: acionar database-security-reviewer em modo read-only no commit publicado; somente após resposta, acionar statistics-domain-reviewer para resolver o BLOCK_RELEASE; revisar acessibilidade/boxscore conforme escopo; ao obter pareceres válidos, convocar qa-reviewer; corrigir conflitos com main e repetir revisões afetadas quando o HEAD mudar.
CRITERIO_DE_CONCLUSAO: pareceres independentes vinculados ao mesmo HEAD, nenhum BLOCK_RELEASE, PR integrável, CI/pgTAP/preview verdes, WIP preservado e handoff reconciliado.
```
