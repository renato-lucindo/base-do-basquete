---
id: TSK-170
tipo: dados
dependencias: [TSK-014, TSK-168]
risco: alto
---

# Consultar conquistas do jogador via elenco

## Objetivo

Associar conquistas ao atleta apenas quando ele consta no `roster_entries` da inscrição premiada.

## Escopo permitido

Consulta do perfil e testes.

## Passos

1. Partir do `player_id`.
2. Juntar elenco → inscrição → competição.
3. Aplicar os mesmos filtros de confirmação.
4. Evitar depender de `players.team_id`.
5. Remover duplicidades.

## Critérios de aceite

- Atleta recebe conquista somente da edição em que estava inscrito.
- Mudança de time posterior não altera histórico.
- Resultado bate com fixtures.

## Não alterar

Honras manuais existentes.
