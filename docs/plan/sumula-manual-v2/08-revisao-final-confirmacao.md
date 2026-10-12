# Etapa 8 — Revisão final e confirmação inicial

Contrato a integrar: pontos separados Q1–Q4/OT1–OT8; cada OT exige confirmação explícita e empate acumulado do período anterior; faltas Q4/OT compartilham período 4. GD nesse grupo permite pontos Q4/OT pela ausência de cronologia global. O servidor e a transação devem validar autoritativamente empate/consistência/GD, sem confiar nas confirmações do rascunho nem reinterpretar boxscores importados. A correção local da Etapa 7 não implementa esse gate de persistência.

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
