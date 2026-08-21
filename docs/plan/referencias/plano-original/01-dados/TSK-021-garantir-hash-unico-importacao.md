---
id: TSK-021
tipo: banco
dependencias: [TSK-005, TSK-006]
risco: alto
---

# Garantir hash único de importação

## Objetivo

Impedir duplicidade de PDF mesmo sob requisições concorrentes.

## Escopo permitido

`boxscore_imports`/`import_logs`, índice único, estados e teste SQL.

## Passos

1. Confirmar algoritmo e formato do hash.
2. Localizar duplicidades existentes.
3. Definir se a unicidade é global ou por fonte conforme contrato.
4. Adicionar garantia única no banco, se ausente.
5. Testar duas transações concorrentes com o mesmo hash.

## Critérios de aceite

- Exatamente uma importação é confirmada.
- A outra recebe conflito identificável.
- Uma tentativa falha não mascara uma importação confirmada.

## Não alterar

Leitura de PDF, rate limit ou mensagens de UI.
