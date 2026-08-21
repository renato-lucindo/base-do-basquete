---
id: TSK-172
tipo: dados-admin
dependencias: [TSK-002, TSK-014]
risco: alto
---

# Auditar pendências da migração de elencos

## Objetivo

Tratar registros de `roster_migration_issues` sem inferir automaticamente históricos ambíguos.

## Escopo permitido

Consulta administrativa, relatório e, se existente, fluxo explícito de resolução.

## Passos

1. Listar pendências não resolvidas.
2. Agrupar por tipo e contexto.
3. Exibir evidências de origem.
4. Exigir escolha administrativa para ambiguidade.
5. Marcar resolução com timestamp sem apagar o registro.

## Critérios de aceite

- Nenhuma pendência ambígua é resolvida por heurística silenciosa.
- Ação é auditável.
- Dados históricos originais permanecem.

## Não alterar

Migration já aplicada ou dados em massa automaticamente.
