# MVP-02 — Jogadores públicos e estabilidade boxscore

## Estado

`DONE` na branch `feature/admin-workflow-improvements` da PR draft #35.

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

- Commits funcionais `b7c0030` e `603f725`: migration aditiva, seis read models com `security_invoker`, grants/RLS mínimos, DTO discriminado por fonte, loaders server-side, listagem, perfil e detalhe de jogo coerentes.
- Gate local completo aprovado: Biome, TypeScript estrito, 28 arquivos/102 testes Vitest, quatro runbooks, builds cliente/SSR, scan de 491 arquivos e `git diff --check`.
- Banco desde zero e pgTAP aprovados na execução `34386933182`, incluindo 35 asserções focais de RLS, autoridade, ausência nula, DNP e denominadores total/avançado.
- `gate`, `database`, preview e CodeQL aprovados nas execuções `34386933182`, `34386933194` e `34386933248`.
- Migration `20260909153000_mvp02_public_player_read_models.sql` aplicada ao Supabase compartilhado pelo SQL Editor com resultado `Success. No rows returned`; aplicação foi aditiva e não regravou dados esportivos.
- Preview público validado em 390, 768 e 1280 px. O cenário de súmula exibiu estado vazio honesto; o cenário FIBA listou 35 atletas, preservou busca/ordenação na URL, reconciliou perfil e jogo 63 em 93 × 39 e não apresentou overflow do documento.
- Navegação por teclado mostrou foco visível de 3 px, tabelas usaram rolagem contida e o console do navegador permaneceu sem erros.
- Nenhum merge ou deploy de produção foi executado.
