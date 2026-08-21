---
id: TSK-182
tipo: ci
dependencias: [TSK-180, TSK-181]
risco: medio
---

# Configurar job de lint

## Objetivo

Executar o lint completo do projeto em PR e push na `main`.

## Escopo permitido

Workflow existente e ajuste mínimo de script somente se comprovadamente necessário.

## Passos

1. Fixar versão de Node compatível.
2. Instalar dependências por lockfile.
3. Executar script completo, não apenas `lint:critical`.
4. Falhar o job em erro.
5. Testar sintaxe do workflow.

## Critérios de aceite

- PR com erro de lint é bloqueável.
- Lockfile não é reescrito.
- Job não possui permissão de escrita desnecessária.

## Não alterar

Regras ESLint nesta tarefa.
