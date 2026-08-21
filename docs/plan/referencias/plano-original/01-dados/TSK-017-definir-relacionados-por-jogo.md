---
id: TSK-017
tipo: banco
dependencias: [TSK-004, TSK-014, TSK-016]
risco: alto
---

# Definir representação dos relacionados por jogo

## Objetivo

Decidir se os relacionados são representados por tabela própria ou pela estrutura existente de `scoresheet_entries`, sem criar duplicidade.

## Escopo permitido

Decisão de persistência e, se comprovadamente necessário, migration aditiva isolada.

## Passos

1. Auditar como `scoresheet_entries`, `boxscores` e o editor atual registram jogador, equipe e camisa.
2. Comparar com o requisito de `game_rosters`.
3. Definir uma única fonte da verdade para presença no jogo.
4. Planejar compatibilidade com dados importados.
5. Implementar somente após aprovar o contrato.

## Critérios de aceite

- Existe uma única fonte da verdade por fluxo.
- Jogador relacionado sempre pertence ao elenco da edição.
- Consultas existentes continuam válidas.

## Não alterar

Grade de estatísticas ou comportamento visual.
