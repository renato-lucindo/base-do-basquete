---
id: TSK-089
tipo: dominio
dependencias: [TSK-054, TSK-088]
risco: alto
---

# Validar consistência do boxscore

## Objetivo

Bloquear payload com placar ou tentativas inconsistentes antes da transação.

## Escopo permitido

Validador puro e testes.

## Passos

1. Verificar equipes diferentes.
2. Verificar presença de atletas.
3. Verificar acertos ≤ tentativas.
4. Recalcular pontos por `2×2PC + 3×3PC + LLC`.
5. Comparar soma dos atletas com o placar.

## Critérios de aceite

- Cada falha gera código/campo identificável.
- Aviso não é confundido com erro bloqueante.
- Validador não consulta banco.

## Não alterar

Associação de nomes.
