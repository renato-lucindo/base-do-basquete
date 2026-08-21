---
id: TSK-056
tipo: dominio
dependencias: [TSK-051, TSK-052, TSK-053, TSK-055]
risco: medio
---

# Calcular médias por jogo

## Objetivo

Derivar médias a partir de totais e `J`, sem persistência.

## Escopo permitido

Transformador de DTO ou consulta/RPC, mais testes.

## Passos

1. Receber totais e jogos.
2. Aplicar divisão somente quando `J > 0`.
3. Definir precisão interna e arredondamento visual.
4. Manter totais no mesmo DTO para o toggle.
5. Testar `J=0`, `J=1` e múltiplos jogos.

## Critérios de aceite

- Nenhuma coluna de média é criada no banco.
- Alternar visualização não dispara recomputação inconsistente.
- Valores batem com os oráculos de `TSK-006`.

## Não alterar

Tabela visual.
