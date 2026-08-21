---
id: TSK-180
tipo: qualidade
dependencias: [TSK-000, TSK-003]
risco: baixo
---

# Auditar comandos de validação

## Objetivo

Confirmar os comandos reais de lint, TypeScript, testes e build antes de configurar CI.

## Escopo permitido

`package.json`, configurações e execução somente leitura.

## Passos

1. Listar scripts.
2. Confirmar se há comando separado de typecheck.
3. Identificar testes unitários e SQL.
4. Executar baseline e registrar falhas preexistentes.
5. Não corrigir falhas nesta tarefa.

## Critérios de aceite

- Cada validação tem comando reproduzível.
- Baseline distingue falha anterior de regressão.
- Ambiente/versões estão registrados.

## Não alterar

Código, scripts ou lockfile.
