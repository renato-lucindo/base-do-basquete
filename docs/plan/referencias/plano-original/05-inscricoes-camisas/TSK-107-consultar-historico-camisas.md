---
id: TSK-107
tipo: dados
dependencias: [TSK-018, TSK-106]
risco: alto
---

# Consultar histórico de camisas

## Objetivo

Unificar ocorrências confirmadas de boxscores e súmulas sem duplicar o mesmo registro.

## Escopo permitido

Consulta/RPC de histórico e testes.

## Passos

1. Identificar fontes autoritativas.
2. Considerar apenas jogos confirmados conforme contrato.
3. Retornar número, jogo e data.
4. Preservar `"00"`.
5. Evitar duplicidade quando duas fontes representam a mesma linha.

## Critérios de aceite

- Cada uso real conta uma vez.
- Rascunhos não contam.
- Histórico pode ser filtrado/auditado.

## Não alterar

Escolha do número mais frequente.
