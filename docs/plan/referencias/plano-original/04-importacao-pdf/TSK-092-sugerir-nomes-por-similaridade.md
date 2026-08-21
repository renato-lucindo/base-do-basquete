---
id: TSK-092
tipo: dominio
dependencias: [TSK-090, TSK-091]
risco: medio
---

# Sugerir candidatos por similaridade

## Objetivo

Ordenar sugestões com algoritmo definido, sem confirmar automaticamente.

## Escopo permitido

`findPlayerSuggestions` ou equivalente e testes.

## Passos

1. Definir distância/score e normalização.
2. Estabelecer limite mínimo e quantidade máxima.
3. Usar contexto de elenco somente como filtro explícito.
4. Incluir score para auditoria interna.
5. Testar trocas, acentos, nomes curtos e empates.

## Critérios de aceite

- Resultado é ordenado e determinístico.
- Score baixo não vira associação.
- Empate de score não é resolvido arbitrariamente.

## Não alterar

Seleção da interface.
