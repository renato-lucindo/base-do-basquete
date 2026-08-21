---
id: TSK-072
tipo: teste
dependencias: [TSK-058, TSK-061, TSK-062, TSK-063, TSK-068, TSK-071]
risco: baixo
---

# Testar isolamento e cache de estatísticas

## Objetivo

Cobrir regressões de contexto, modo, cache e interface.

## Escopo permitido

Testes unitários, integração e SQL.

## Cenários

1. Mesmo jogador em duas categorias.
2. Totais e médias.
3. Hit, miss e valor de cache corrompido.
4. Invalidação seletiva após cada fluxo de escrita.
5. Categoria simples sem chamadas avançadas.
6. Comparação com empate e campo ausente.

## Critérios de aceite

- Testes falham se o filtro de competição for removido.
- Chaves de contextos diferentes são distintas.
- Nenhum teste depende de rede externa.

## Não alterar

Código de produto nesta tarefa.
