---
id: TSK-052
tipo: dados
dependencias: [TSK-051]
risco: alto
---

# Agregar PTS, REB, RO, RD e AST

## Objetivo

Somar métricas básicas por jogador dentro de uma edição.

## Escopo permitido

Consulta/RPC de agregação e teste específico.

## Passos

1. Confirmar colunas autoritativas do boxscore.
2. Definir tratamento de `null`.
3. Somar por jogador após filtrar a competição.
4. Validar `REB = RO + RD` quando o domínio exigir.
5. Testar zero, ausência e múltiplos jogos.

## Critérios de aceite

- Totais reproduzem a soma das fixtures.
- Dados ausentes não viram valores enganosos.
- Isolamento ocorre antes do agrupamento.

## Não alterar

Percentuais, médias ou componentes.
