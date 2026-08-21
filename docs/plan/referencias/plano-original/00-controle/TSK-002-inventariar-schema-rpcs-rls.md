---
id: TSK-002
tipo: auditoria
dependencias: [TSK-000]
risco: baixo
---

# Inventariar schema, RPCs e políticas

## Objetivo

Levantar o estado efetivo do banco antes de planejar novas migrations.

## Escopo permitido

Somente leitura de migrations, tipos gerados, funções SQL, triggers, índices, constraints e políticas RLS.

## Passos

1. Listar tabelas e colunas usadas por competições, jogos, inscrições, súmulas e importações.
2. Listar RPCs, incluindo fluxos transacionais existentes.
3. Mapear FKs, exclusividades, checks, índices e triggers.
4. Mapear políticas RLS para `anon`, usuário autenticado e administrador.
5. Comparar migration versionada, tipos TypeScript e banco alvo quando houver acesso.

## Critérios de aceite

- Matriz tabela × regra × proteção preenchida.
- Divergências entre migration, tipos e banco estão explícitas.
- Nenhuma migration nova foi criada.

## Não alterar

Schema, dados, migrations ou tipos gerados.
