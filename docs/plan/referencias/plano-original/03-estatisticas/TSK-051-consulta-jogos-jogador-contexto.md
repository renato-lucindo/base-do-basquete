---
id: TSK-051
tipo: dados
dependencias: [TSK-016, TSK-031, TSK-006]
risco: alto
---

# Calcular jogos disputados por contexto

## Objetivo

Produzir `J` sem contar partidas de outra edição ou duplicar jogador.

## Escopo permitido

Consulta/RPC de estatísticas e teste de dados.

## Passos

1. Definir o que caracteriza participação no jogo.
2. Filtrar sempre por `competition_id`.
3. Contar jogos distintos.
4. Excluir registros cancelados conforme contrato.
5. Testar jogador multi-categoria.

## Critérios de aceite

- `J` coincide com fixture manual.
- O mesmo jogo não é contado duas vezes.
- Nenhum filtro usa apenas o time global do jogador.

## Não alterar

Outras métricas ou UI.
