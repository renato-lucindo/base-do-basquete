---
id: TSK-138
tipo: frontend
dependencias: [TSK-137]
risco: medio
---

# Implementar inputs de 2, 3 e lance livre

## Objetivo

Registrar quantidades convertidas por jogador e período com valores inteiros não negativos.

## Escopo permitido

Células de arremessos e testes.

## Passos

1. Aceitar vazio durante edição e normalizar no commit.
2. Recusar decimal, negativo e texto.
3. Desabilitar para slot N/A/GD quando aplicável.
4. Manter rótulo acessível por jogador/período.
5. Testar entrada e navegação por teclado.

## Critérios de aceite

- Valor persistível é inteiro ≥ 0.
- Um campo não move foco inesperadamente.
- Cálculo é delegado a `TSK-139`.

## Não alterar

Fórmula ou backend.
