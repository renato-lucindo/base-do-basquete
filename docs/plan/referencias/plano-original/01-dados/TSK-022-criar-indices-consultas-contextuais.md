---
id: TSK-022
tipo: desempenho
dependencias: [TSK-011, TSK-013, TSK-014, TSK-016, TSK-019, TSK-021]
risco: medio
---

# Validar índices das consultas contextuais

## Objetivo

Garantir índices alinhados aos filtros reais sem criar índices redundantes.

## Escopo permitido

Análise de planos, migration de índices e testes de consulta.

## Passos

1. Capturar consultas de resolução, elenco, jogos, estatísticas e camisa.
2. Executar `EXPLAIN` em conjunto representativo.
3. Comparar com índices existentes.
4. Adicionar apenas índices que removam varredura relevante.
5. Verificar custo de escrita e redundância.

## Critérios de aceite

- Cada índice novo tem consulta e plano que justificam sua existência.
- Não há índice duplicado por prefixo equivalente.
- Tempo-alvo é registrado em dados de teste.

## Não alterar

Semântica de consultas ou dados.
