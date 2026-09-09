# MVP-02 — Jogadores públicos e estabilidade boxscore

- **Estado atual:** `DONE`
- **Incorpora:** `04A`, `04B`, `04C`, `04D`, `05A`, `05B`
- **Meta:** 1–2 janelas.

## Entregar

- Read model de edição/jogo para súmula com J, PTS, PTS/J, 2PC, 3PC, LLC, faltas, desqualificações e DNP correto.
- DTO discriminado e loader server-side orientado pelo perfil e autoridade, nunca por `has_advanced_stats` ou contagem de jogos.
- Listagem pública responsiva com busca, equipe, ordenação, URL restaurável e estados completos.
- Perfil contextual do atleta reconciliado com a listagem.
- Read model boxscore com denominadores reais, separando jogos totais de jogos com cobertura avançada.
- Regressão visual e funcional do cenário 100% boxscore.

## Corte consciente

Boxscore suplementar raro em edição manual fica em `POST-01`. Até lá, somente dados da autoridade principal entram no agregado.

## Gate

Banco/domínio/UI em um ciclo: ausência permanece nula, fontes não são somadas no mesmo domínio, totais listagem/perfil conferem, cenário FIBA não regride e 390/768/desktop/teclado passam.
