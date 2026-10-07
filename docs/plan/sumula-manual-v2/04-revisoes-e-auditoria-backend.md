# Etapa 4 — Revisões e auditoria no backend

## Objetivo

Criar revisões auditáveis da súmula salva com controle de concorrência e preservação de snapshots anteriores.

## Atividades

- Criar RPC separada de revisão.
- Carregar a submissão ativa.
- Tornar mandante e visitante imutáveis.
- Implementar `baseSubmissionId/hash`.
- Exigir motivo textual.
- Criar nova versão sem alterar snapshots anteriores.
- Registrar autor, data, motivo e diff.
- Rejeitar revisão concorrente desatualizada.
- Incluir cálculo correto dos LL de penalidade concedidos e recebidos.

## Checkpoint

Revisão e concorrência funcionam somente via testes/backend antes de depender da UI.

## Commit esperado

`feat: version manual scoresheet revisions`
