---
id: TSK-010
tipo: banco
dependencias: [TSK-002, TSK-004, TSK-006]
risco: alto
---

# Auditar e completar `competition_series`

## Objetivo

Garantir que o campeonato genérico esteja separado das edições anuais sem duplicar a migration já existente.

## Escopo permitido

`supabase/migrations/*competition*`, testes SQL específicos e tipos gerados somente após aprovação da migration.

## Passos

1. Confirmar tabela, PK, `name`, `slug`, atividade e timestamps.
2. Confirmar unicidade e formato do slug.
3. Verificar backfill de séries a partir das competições existentes.
4. Testar repetição segura da lógica de backfill em banco limpo.
5. Criar migration aditiva apenas se houver lacuna comprovada.

## Critérios de aceite

- Uma série representa o campeonato genérico.
- Slug inválido ou duplicado é recusado.
- Edições existentes permanecem vinculadas.
- Teste SQL passa em banco novo.

## Não alterar

Tabelas de jogos, elencos ou rotas.
