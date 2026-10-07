# Etapa 8 — Revisão final e confirmação inicial

## Objetivo

Concluir o fluxo de criação e acionar a gravação somente após revisão explícita do operador.

## Atividades

- Implementar a quarta etapa do wizard.
- Exibir placar, parciais, faltas, GD, elenco, comissão, oficiais e metadados.
- Chamar a RPC transacional da Etapa 3 somente na confirmação final.
- Tratar retry com a mesma `idempotency key`.
- Limpar o rascunho somente após confirmação real da gravação.
- Validar teclado, foco e mensagens de erro.

## Checkpoint

Fluxo novo completo funciona de ponta a ponta.

## Commit esperado

`feat: confirm manual scoresheet v2`
