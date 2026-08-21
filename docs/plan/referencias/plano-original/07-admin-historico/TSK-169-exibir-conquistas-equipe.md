---
id: TSK-169
tipo: frontend
dependencias: [TSK-042, TSK-168]
risco: baixo
---

# Exibir conquistas no perfil da equipe

## Objetivo

Apresentar títulos/colocações confirmados sem confundir participação com conquista.

## Escopo permitido

Página/componente público da equipe e teste.

## Passos

1. Consumir consulta pronta.
2. Destacar colocação conforme regra editorial.
3. Exibir ano, competição e categoria.
4. Linkar para contexto correspondente.
5. Tratar lista vazia.

## Critérios de aceite

- Somente resultados confirmados aparecem.
- Link abre a edição correta.
- Texto não afirma “campeão” para colocação diferente de 1.

## Não alterar

Consulta ou resultado.
