---
id: TSK-188
tipo: desempenho
dependencias: [TSK-022, TSK-061, TSK-072]
risco: medio
---

# Medir desempenho das estatísticas

## Objetivo

Registrar latência de miss, hit e consulta SQL em volume representativo.

## Escopo permitido

Benchmark/roteiro de carga controlado e relatório.

## Passos

1. Definir volume de jogos/jogadores.
2. Medir consulta sem cache.
3. Medir primeiro miss e hits seguintes.
4. Medir categorias simples e avançadas.
5. Registrar p50/p95 e ambiente.

## Critérios de aceite

- Resultados são reproduzíveis.
- Meta de desempenho é explícita.
- Benchmark não atinge produção.

## Não alterar

Índices ou código nesta tarefa.
