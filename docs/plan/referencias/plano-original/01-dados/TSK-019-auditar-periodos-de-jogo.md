---
id: TSK-019
tipo: banco
dependencias: [TSK-016]
risco: alto
---

# Auditar armazenamento de períodos

## Objetivo

Suportar Q1–Q4 e quantidade variável de OTs sem colunas rígidas por período.

## Escopo permitido

Estrutura existente de `game_period_stats` ou equivalente, constraints e testes.

## Passos

1. Confirmar chave por jogo, equipe e índice do período.
2. Definir códigos/ordem de Q1–Q4, OT1, OT2...
3. Impedir períodos duplicados para a mesma equipe.
4. Validar pontos não negativos.
5. Provar consulta ordenada e soma determinística.

## Critérios de aceite

- O número de OTs não é limitado pelo schema.
- Cada período possui ordem inequívoca.
- Soma dos períodos pode ser validada contra o placar.

## Não alterar

Regra visual de abrir OT ou encerramento de jogo.
