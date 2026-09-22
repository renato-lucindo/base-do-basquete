# STATS-02 — Backend e domínio boxscore

## Entrega

O novo DTO `boxscore-v2` é exclusivo de contexto publicado com perfil `fiba_boxscore`. O servidor lê somente o snapshot atual permitido por RLS e aplica allowlists de modo, escopo, métrica, operador, ordenação, página e comparação.

Busca, equipe, filtros, ordenação, líderes, paginação de 20 linhas e comparação fora da página são processados no backend. Líderes são calculados antes da paginação e valores indisponíveis ficam fora de filtros e líderes.

O domínio implementa `per-game`, `total` e `per-30`, preserva percentuais e saldo em quadra conforme o contrato, diferencia `insufficient-sample` de `unavailable` e usa o limite por 30 congelado em cada linha de publicação. O catálogo único concentra sigla, nome público, normalização e direção de liderança de cada métrica.

## Cobertura focal

- parser seguro e descarte de `MIN` em filtros/ordenação por 30;
- limites inclusivos 9:59/10:00 e limite versionado no snapshot;
- percentuais e `+/-` não escalados;
- `FR` indisponível permanece `null`;
- líderes antes da paginação e comparados fora da página;
- súmula, legado e perfil divergente recusados antes da leitura das linhas.

