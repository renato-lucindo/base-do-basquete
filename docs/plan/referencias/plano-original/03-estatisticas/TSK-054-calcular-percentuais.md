---
id: TSK-054
tipo: dominio
dependencias: [TSK-053, TSK-005]
risco: medio
---

# Calcular FG%, 3P% e LL%

## Objetivo

Aplicar fórmula única e tratamento seguro de divisão por zero.

## Escopo permitido

Função pura compartilhada/SQL e testes unitários.

## Passos

1. Definir escala interna e arredondamento de apresentação.
2. Calcular `acertos / tentativas`.
3. Retornar valor ausente definido para zero tentativas.
4. Não persistir percentual.
5. Testar limites e arredondamento.

## Critérios de aceite

- Backend e frontend não divergem na fórmula.
- Zero tentativa não produz `NaN` ou infinito.
- Percentual não é armazenado no banco.

## Não alterar

Agregações de origem.
