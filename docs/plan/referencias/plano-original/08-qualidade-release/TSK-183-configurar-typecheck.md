---
id: TSK-183
tipo: ci
dependencias: [TSK-180, TSK-181]
risco: medio
---

# Configurar verificação TypeScript

## Objetivo

Executar verificação de tipos sem depender incidentalmente do build.

## Escopo permitido

Script de typecheck e workflow, se a auditoria provar ausência.

## Passos

1. Definir comando compatível com o tsconfig.
2. Não emitir arquivos.
3. Adicionar job/etapa.
4. Testar erro proposital localmente sem commitá-lo.
5. Registrar tempo.

## Critérios de aceite

- Erro de tipo falha a CI.
- Tipos Supabase são incluídos.
- Não há artefatos gerados no repositório.

## Não alterar

Tipos de produto para silenciar falhas.
