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
