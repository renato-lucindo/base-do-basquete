---
id: TSK-142
tipo: dominio
dependencias: [TSK-020, TSK-006]
risco: alto
---

# Implementar predicado de desqualificação GD

## Objetivo

Derivar GD para 2T, 2U ou 1T + 1U conforme códigos canônicos.

## Escopo permitido

Função pura compartilhada e testes.

## Passos

1. Contar T e U conforme decisão sobre U/U2.
2. Aplicar exatamente os três gatilhos.
3. Retornar motivo além do booleano.
4. Não considerar faltas posteriores para decidir o instante inicial.
5. Testar combinações limítrofes e remoção de falta.

## Critérios de aceite

- Cada gatilho possui teste positivo.
- Combinações insuficientes possuem teste negativo.
- Backend usa a mesma tabela de decisão.

## Não alterar

UI ou persistência.
