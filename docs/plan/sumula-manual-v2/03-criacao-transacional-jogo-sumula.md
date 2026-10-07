# Etapa 3 — Criação transacional jogo + súmula

## Objetivo

Garantir que jogo e súmula sejam criados juntos, de forma atômica e idempotente.

## Atividades

- Implementar RPC única para a confirmação inicial.
- Criar matchup, jogo e súmula na mesma transação.
- Exigir somente mandante, visitante e data.
- Validar inscrições/equipes permitidas.
- Implementar `idempotency key`.
- Garantir rollback completo em qualquer erro.
- Persistir elenco, camisas, capitão, titulares, comissão, oficiais, pontos e faltas.

## Checkpoint

Testes provam sucesso atômico, ausência de jogo órfão e retry idempotente.

## Commit esperado

`feat: create game and manual scoresheet atomically`
