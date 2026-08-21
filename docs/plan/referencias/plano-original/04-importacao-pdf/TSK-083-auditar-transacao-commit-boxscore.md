---
id: TSK-083
tipo: banco
dependencias: [TSK-015, TSK-016, TSK-021, TSK-023, TSK-081, TSK-082]
risco: alto
---

# Auditar transação `commit_boxscore_import`

## Objetivo

Provar que jogo, atletas, inscrições, boxscores e status da importação são confirmados ou revertidos em conjunto.

## Escopo permitido

RPC existente, migration corretiva mínima e testes SQL.

## Passos

1. Listar todas as escritas realizadas.
2. Injetar falha em etapa intermediária.
3. Confirmar rollback integral.
4. Verificar bloqueio por hash e conflitos de elenco.
5. Confirmar status/erro da tentativa sem deixar jogo parcial.

## Critérios de aceite

- Nenhum dado parcial sobrevive à falha.
- Reexecução tem comportamento idempotente definido.
- Sucesso retorna exatamente um `game_id`.

## Não alterar

Parser, cache ou página de jogo.
