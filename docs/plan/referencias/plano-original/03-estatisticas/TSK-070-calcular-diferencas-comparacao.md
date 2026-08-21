---
id: TSK-070
tipo: dominio-frontend
dependencias: [TSK-057, TSK-069]
risco: medio
---

# Calcular diferenças da comparação

## Objetivo

Comparar métricas equivalentes sem confundir totais, médias e percentuais.

## Escopo permitido

Função pura de comparação e testes.

## Passos

1. Receber modo de visualização.
2. Comparar somente campos disponíveis para todos.
3. Definir se maior é melhor por métrica; não assumir para todas.
4. Tratar empate e ausência.
5. Testar sinais e escalas.

## Critérios de aceite

- Resultado inclui `melhor`, `pior`, `igual` ou `indisponível`.
- Total nunca é comparado com média.
- Regra por métrica está documentada.

## Não alterar

Renderização ou backend.
