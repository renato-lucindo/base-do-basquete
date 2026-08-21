---
id: TSK-140
tipo: dominio
dependencias: [TSK-137, TSK-139]
risco: alto
---

# Derivar totais de jogador e equipe

## Objetivo

Somar períodos por atleta e atletas por equipe sem campos concorrentes.

## Escopo permitido

Seletores/funções puras e testes.

## Passos

1. Calcular pontos de cada célula.
2. Somar períodos por jogador.
3. Somar jogadores ativos por equipe.
4. Comparar com períodos da equipe se persistidos.
5. Excluir N/A.

## Critérios de aceite

- `Total_Equipe = soma dos jogadores`.
- Totais atualizam imediatamente.
- Nenhuma soma é armazenada duas vezes no estado.

## Não alterar

Encerramento ou OT.
