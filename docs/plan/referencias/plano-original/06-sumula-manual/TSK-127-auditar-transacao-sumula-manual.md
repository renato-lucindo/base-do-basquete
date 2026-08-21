---
id: TSK-127
tipo: banco
dependencias: [TSK-016, TSK-017, TSK-019, TSK-020, TSK-121, TSK-126]
risco: alto
---

# Auditar transação da súmula manual

## Objetivo

Provar que jogo, relacionados, estatísticas, períodos, placar e estado são gravados em uma transação.

## Escopo permitido

RPC/serviço existente de súmula manual, migration corretiva e testes SQL.

## Passos

1. Enumerar escritas e ordem atual.
2. Validar competição, equipes e elencos no banco.
3. Injetar erro em um jogador.
4. Confirmar rollback integral.
5. Definir idempotência e resposta com `game_id`.

## Critérios de aceite

- Nenhuma súmula parcial é visível.
- Reenvio não duplica jogo.
- Admin e regras de domínio são verificados no RPC.

## Não alterar

Editor visual ou cache, além do gancho pós-commit de `TSK-063`.
