---
id: TSK-137
tipo: frontend-dominio
dependencias: [TSK-019, TSK-131]
risco: medio
---

# Modelar estado da grade por períodos

## Objetivo

Representar linhas por jogador e células por Q1–Q4/OT sem duplicar estado derivado.

## Escopo permitido

Tipos/reducer do editor e testes unitários.

## Passos

1. Definir chave por equipe, jogador e período.
2. Manter eventos/conversões mínimos.
3. Derivar totais em seletores puros.
4. Remover estado do slot N/A.
5. Suportar adição ordenada de OT.

## Critérios de aceite

- Atualizar uma célula não altera outra.
- Totais não são armazenados em duplicidade.
- Serialização é determinística.

## Não alterar

Inputs visuais ou RPC.
