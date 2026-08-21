---
id: TSK-000
tipo: controle
dependencias: []
risco: baixo
---

# Fixar baseline de execução

## Objetivo

Registrar exatamente qual estado do repositório será usado antes de qualquer auditoria ou alteração.

## Escopo permitido

Somente leitura de Git e criação do registro de execução da tarefa.

## Passos

1. Confirmar repositório, branch, SHA e remotes.
2. Confirmar se a árvore está limpa; listar mudanças sem modificá-las.
3. Registrar versões de Node, gerenciador de pacotes e Supabase CLI, se disponível.
4. Registrar os comandos reais de `lint`, `test` e `build` do `package.json`.
5. Interromper se branch, SHA ou mudanças locais não corresponderem ao trabalho autorizado.

## Critérios de aceite

- Baseline contém repositório, branch, SHA, data e comandos.
- Nenhum arquivo de produto foi alterado.
- Mudanças preexistentes foram preservadas.

## Não alterar

Código, banco, dependências, configuração, branch ou histórico Git.
