---
id: TSK-185
tipo: ci-banco
dependencias: [TSK-002, TSK-180, TSK-181]
risco: alto
---

# Configurar smoke tests de migrations e SQL

## Objetivo

Aplicar migrations em banco descartável e executar testes de constraints/RPCs.

## Escopo permitido

Workflow de CI, configuração local Supabase e testes SQL.

## Passos

1. Inicializar banco efêmero.
2. Aplicar migrations do zero.
3. Executar smoke tests, incluindo elencos.
4. Falhar em drift ou erro de migration.
5. Descartar o ambiente.

## Critérios de aceite

- Banco limpo chega ao schema esperado.
- Testes não acessam projeto de produção.
- Falha mostra migration/teste responsável.

## Não alterar

Migrations nesta tarefa.
