---
id: TSK-055
tipo: dados
dependencias: [TSK-051, TSK-052, TSK-053]
risco: alto
---

# Calcular MIN, EF e +/-

## Objetivo

Implementar somente as métricas avançadas cuja origem e fórmula estiverem comprovadas.

## Escopo permitido

Contrato/funções de métricas avançadas e testes.

## Passos

1. Auditar disponibilidade de minutos, eficiência e mais/menos no parser e banco.
2. Registrar fórmula de eficiência adotada.
3. Não inferir `+/-` quando faltarem eventos/dados autoritativos.
4. Diferenciar zero real de dado indisponível.
5. Testar exemplos calculados manualmente.

## Critérios de aceite

- Cada métrica possui fonte e fórmula documentadas.
- Campo indisponível não é fabricado.
- Apenas categorias autorizadas recebem a métrica.

## Não alterar

Parser de PDF nesta tarefa.
