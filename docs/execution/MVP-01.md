# Execução MVP-01 — Jogo estrutural e ingestão principal

## Baseline

- Branch: `feature/admin-workflow-improvements`.
- PR: `#35`, draft, head inicial `f74c4a887a1dba50a688f55888c335ed08fd0378`.
- Checks iniciais: `analyze`, `database`, `gate` e `upload` aprovados.
- Preview inicial: `/health` respondeu `status: ok`.
- Última migration aplicada no baseline: `20260903042439_game_data_backfill.sql`.
- Backfill versionado preservado: 9 submissões, 4 ativas, 5 em revisão e 28 autoridades, conforme evidências do `HANDOFF.md`.

## Allowlist do pacote

- `supabase/migrations/*mvp01*.sql` e pgTAP diretamente relacionado.
- `supabase/seed.sql`, apenas se necessário para cumprir a integridade estrutural.
- `app/modules/ingestion/*`.
- Fluxos de súmula manual e importação FIBA, seus componentes e testes.
- Tipos de banco gerados.
- Este registro de execução, estado do pacote e `HANDOFF.md`.

## Decisões

- O histórico recebe contêiner explícito `legacy_unclassified`; nenhuma fase, rodada, sexo, naipe ou confronto é inferido além dos participantes já gravados.
- `games.matchup_id` permanece anulável para compatibilidade e auditoria, mas os fluxos administrativos novos serão bloqueados fora de um confronto válido.
- Confirmações manual e FIBA passam a operar sobre um jogo existente e ativam apenas domínios compatíveis com sua fonte.
- Fallback, suplemento, resolução visual de conflitos, editor estrutural e progressão permanecem nos pacotes posteriores previstos no plano.

## Implementação desta unidade

- Súmula manual e confirmação FIBA exigem `gameId`, bloqueiam jogo sem `matchup` e gravam somente no jogo estrutural selecionado.
- O banco mantém a confirmação atômica e idempotente, rejeita divergência de participantes/dados e ativa apenas as autoridades compatíveis da fonte.
- A importação FIBA preserva a validação assistida de atletas e as estatísticas coletivas; seu adaptador de compatibilidade não deixa jogo temporário persistente.
- Novas escritas de jogo sem confronto são bloqueadas pelo banco. Somente fixtures locais versionadas usam a chave interna explícita durante o seed/teste.
- As telas administrativas exibem apenas jogos estruturais confirmáveis e travam equipes, horário e local segundo o jogo escolhido.

## Evidência local

- `npm.cmd run check`: aprovado em 2026-09-09.
- Vitest: 24 arquivos e 92 testes aprovados, incluindo as duas fixtures PDF FIBA/Genius Sports.
- TypeScript, Biome, runbooks, build Worker e varredura de segredos: aprovados.
- pgTAP atualizado para jogo existente, rollback, elegibilidade, idempotência, estatísticas coletivas e bloqueio de jogo paralelo; execução PostgreSQL limpa fica a cargo do job `database`, pois este host não possui Docker/Podman.
