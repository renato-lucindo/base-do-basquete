# Etapa 6 — Lançamento rápido de pontos

## Objetivo

Permitir transcrição de pontuação com fluxo principal integralmente por teclado.

## Atividades

- Implementar máquina de estados `aguardando camisa -> aguardando valor`.
- Suportar sequências como `12 Enter 2 Enter`.
- Preservar `00` como string.
- Aceitar somente valores `1`, `2` e `3`.
- Implementar foco automático após cada lançamento.
- Implementar `Esc` para cancelar entrada parcial.
- Implementar `Ctrl+Z` e histórico curto local.
- Manter a grade existente para correções.
- Suportar Q1–Q4 e OT1–OT8 por botão Adicionar OT. OT1 exige Q4 explicitamente concluído e empate acumulado; OT seguinte exige a mesma conferência no OT anterior. Confirmações e períodos adicionados são restauráveis; editar pontos, desfazer ou trocar elenco/equipe invalida confirmações afetadas, preservando dados para correção.
- Garantir operação integral por teclado e feedback acessível.

## Checkpoint

Fluxo completo de pontos funciona sem mouse e sem servidor.

## Commit esperado

`feat: add keyboard-first scoring entry`
