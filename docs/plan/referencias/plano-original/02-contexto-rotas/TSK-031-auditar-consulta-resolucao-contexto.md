---
id: TSK-031
tipo: dados-frontend
dependencias: [TSK-012, TSK-030]
risco: alto
---

# Auditar consulta de resolução do contexto

## Objetivo

Resolver exatamente uma edição a partir de ano, slug da série e slug da categoria.

## Escopo permitido

`competitionContextQuery` em `src/lib/queries.ts` ou módulo extraído, mais teste alvo.

## Passos

1. Confirmar validação do ano antes da consulta.
2. Confirmar filtros pelos três parâmetros.
3. Confirmar retorno `null` para inexistente e erro para ambiguidade.
4. Verificar chave do React Query completa.
5. Testar duas categorias e anos com slugs semelhantes.

## Critérios de aceite

- Contextos não vazam entre chaves de cache.
- Combinação inexistente não cai em competição padrão.
- Consulta retorna ID e metadados canônicos.

## Não alterar

Consultas de jogos, jogadores ou equipes.
