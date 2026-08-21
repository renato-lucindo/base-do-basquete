---
id: TSK-063
tipo: integracao
dependencias: [TSK-060, TSK-061, TSK-127]
risco: alto
---

# Invalidar cache após súmula manual

## Objetivo

Aplicar a mesma garantia de consistência ao fluxo manual.

## Escopo permitido

Orquestração pós-commit da súmula manual e teste.

## Passos

1. Receber competição do jogo salvo.
2. Invalidar chaves após commit.
3. Cobrir criação e edição confirmada.
4. Não invalidar rascunho.
5. Registrar erro operacional.

## Critérios de aceite

- Dados públicos refletem a súmula confirmada.
- Edições não relacionadas permanecem cacheadas.
- Falha de salvamento não altera cache.

## Não alterar

Editor ou regra de pontuação.
