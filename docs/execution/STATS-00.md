# STATS-00 — Baseline das estatísticas públicas de boxscore

## Unidade

- Base: `fe64235` (`main` após a PR #51).
- Branch: `codex/stats-player-statistics`.
- Plano normativo: `docs/plan/improvements/PLANO-ESTATISTICAS-JOGADORES-END-TO-END.md`.
- Escopo negativo: nenhuma migration aplicada, nenhum deploy, nenhuma mudança no Supabase compartilhado e nenhuma alteração de comportamento público nesta unidade.

## Oráculos congelados

O contrato exclusivo de boxscore admite os modos `per-game`, `total` e `per-30` e os escopos `regular`, `playoffs` e `all`, totalizando nove pares válidos. Valores de URL fora das allowlists retornam aos padrões seguros `per-game` e `regular`.

O escopo é derivado exclusivamente de `competition_stages.stage_kind`: `round_robin` participa de `regular` e `all`; o valor canônico existente `knockout` é apresentado como `playoffs` e participa de `playoffs` e `all`; `null` e `legacy_unclassified` participam somente de `all`. Nenhum nome, código, data ou número de rodada é usado para inferir a fase.

O limite por 30 minutos é inclusivo em 600 segundos: 9:59 permanece inelegível e 10:00 é elegível. A fórmula congelada é `total × 1800 ÷ segundos cobertos`; zero segundos nunca divide.

Somente perfil publicado e ativo com `primary_source = 'fiba_boxscore'` entra no novo contrato. O identificador interno abrange FIBA/Genius Sports e Basketball Site. Súmula manual, perfil pendente e contexto legado continuam no explorador atual apenas como divergência conhecida e não podem acessar o DTO futuro de boxscore.

## Baseline observada

O explorador existente ainda carrega a view agregada genérica no servidor e executa busca, filtros, ordenação, líderes, comparação e paginação no cliente. Ele possui apenas os modos internos `totals` e `averages`, não recebe escopo estrutural e atende também súmula/legado. Essa divergência é intencionalmente preservada em STATS-00 e será removida por STATS-01 a STATS-03, mantendo o read model anterior por uma versão de rollback.

## Critério de conclusão

- plano versionado na fonte da verdade;
- matriz 3 × 3 testada;
- classificação estrutural testada;
- limites 9:59/10:00 testados;
- elegibilidade por perfil testada;
- comportamento público anterior inalterado.
