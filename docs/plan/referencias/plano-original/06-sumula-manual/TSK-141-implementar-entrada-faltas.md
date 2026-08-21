---
id: TSK-141
tipo: frontend
dependencias: [TSK-020, TSK-137]
risco: medio
---

# Implementar entrada de faltas

## Objetivo

Registrar códigos permitidos por jogador e período preservando ordem/eventos necessários.

## Escopo permitido

Controles de falta e testes.

## Passos

1. Oferecer apenas códigos canônicos.
2. Definir adicionar/remover antes do salvamento.
3. Exibir contagens acumuladas.
4. Acionar avaliação de GD.
5. Tornar controle acessível por teclado.

## Critérios de aceite

- Código inválido não entra no estado.
- Remoção recalcula GD.
- Faltas de um jogador não afetam outro.

## Não alterar

Regra GD ou banco.
