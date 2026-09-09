# MVP-02 — Jogadores públicos e estabilidade boxscore

## Estado

`DOING` na branch `feature/admin-workflow-improvements` da PR draft #35.

## Baseline reconciliada

- Head inicial: `bb13ca6`.
- `gate`, banco desde zero, preview e CodeQL do fechamento do MVP-01: aprovados.
- Preview do pacote anterior: somente branch da PR; produção não será alterada.
- Supabase compartilhado: migrations MVP-01 aplicadas, 9 jogos estruturais, 9 submissões e 28 autoridades preservadas.
- Changelog Supabase consultado em 09/09/2026: a mudança relevante para esta entrega é a exposição explícita do Data API; todas as novas views e permissões serão declaradas na migration.

## Allowlist inicial

- nova migration aditiva e pgTAP focal do MVP-02;
- tipos gerados do Supabase;
- domínio, loaders e testes em `app/modules/statistics/`;
- `app/components/statistics-explorer.tsx`, `app/components/player-profile.tsx` e testes;
- CSS estritamente necessário à listagem simples responsiva e ao aviso de cobertura;
- manifestos do plano acelerado, este relatório e `HANDOFF.md`.

## Decisões de implementação

- O perfil versionado da edição escolhe `scoresheet` ou `boxscore`; `categories.has_advanced_stats` e a contagem de jogos não escolhem mais o DTO.
- A autoridade ativa por domínio seleciona quais jogos alimentam cada agregado. Uma mesma métrica nunca soma duas fontes.
- Pontos oficiais e jogos totais ficam separados dos pontos e jogos com cobertura avançada.
- Ausência permanece `null`; zero só é exibido quando o domínio autoritativo existe e o valor registrado é realmente zero.
- O fluxo raro de boxscore suplementar em edição de súmula continua em `POST-01`.

## Evidências

A preencher durante o gate consolidado do pacote.
