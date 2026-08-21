---
id: TSK-160
tipo: frontend-admin
dependencias: [TSK-024, TSK-044]
risco: medio
---

# Criar seletor principal do dashboard admin

## Objetivo

Exibir uma entrada clara para escolher a edição antes das ações contextuais.

## Escopo permitido

Dashboard administrativo e teste de interação.

## Passos

1. Carregar edições ordenadas.
2. Permitir busca por nome, ano e categoria.
3. Mostrar rótulo completo.
4. Não esconder a gestão global existente.
5. Navegar ao hub da edição.

## Critérios de aceite

- Seleção é inequívoca.
- Lista vazia tem ação apropriada.
- Permissões atuais continuam aplicadas.

## Não alterar

Hub ou módulos administrativos existentes.
