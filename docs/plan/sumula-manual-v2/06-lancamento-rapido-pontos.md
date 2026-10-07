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
- Garantir operação integral por teclado e feedback acessível.

## Checkpoint

Fluxo completo de pontos funciona sem mouse e sem servidor.

## Commit esperado

`feat: add keyboard-first scoring entry`
