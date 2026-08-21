---
id: TSK-058
tipo: integracao
dependencias: [TSK-031, TSK-057, TSK-023]
risco: alto
---

# Expor consulta contextual de estatísticas

## Objetivo

Disponibilizar estatísticas por `competition_id` e capacidades sem aceitar escopo incompleto.

## Escopo permitido

RPC/view segura ou função server-side/TanStack e integração React Query.

## Passos

1. Escolher limite autoritativo conforme a arquitetura atual.
2. Resolver contexto antes de consultar.
3. Exigir `competition_id` no núcleo da consulta.
4. Selecionar DTO simples ou avançado.
5. Mapear erros pelo contrato.

## Critérios de aceite

- Não existe caminho público sem filtro de competição.
- Chave React Query contém contexto e modo.
- RLS/autorização permanecem válidas.

## Não alterar

Cache ou UI.
