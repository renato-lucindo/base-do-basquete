---
id: TSK-004
tipo: decisao
dependencias: [TSK-002, TSK-003]
risco: alto
---

# Definir glossário e modelo canônico

## Objetivo

Resolver a divergência entre `championships/categories/rosters` e `competition_series/competitions/team_registrations/roster_entries`.

## Escopo permitido

Documento de decisão arquitetural; nenhuma migration.

## Passos

1. Mapear cada termo dos requisitos para a entidade real.
2. Confirmar se `competitions` representa uma edição por ano e categoria.
3. Confirmar se a categoria é coluna da edição ou entidade própria.
4. Definir os nomes canônicos de IDs, slugs e relações.
5. Registrar compatibilidade com dados e código existentes.
6. Rejeitar a criação de tabelas paralelas que representem o mesmo conceito.

## Critérios de aceite

- Um conceito possui um único nome canônico.
- Todas as tarefas posteriores apontam para o mesmo modelo.
- Decisão inclui consequências e itens explicitamente fora de escopo.

## Não alterar

Schema, dados ou código.
