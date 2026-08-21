---
id: TSK-012
tipo: banco
dependencias: [TSK-011]
risco: medio
---

# Garantir slugs contextuais válidos

## Objetivo

Assegurar que ano, competição e categoria possam formar URL estável e não ambígua.

## Escopo permitido

Constraints/índices de slugs de séries e edições; testes SQL.

## Passos

1. Inventariar slugs atuais e caracteres incompatíveis.
2. Definir normalização sem modificar URLs existentes.
3. Validar formato no banco.
4. Criar índice que sustente a consulta por ano + série + categoria.
5. Testar slug inexistente, duplicado e com caixa/espaço.

## Critérios de aceite

- Resolução contextual é determinística.
- Índice corresponde ao filtro real da consulta.
- Nenhum slug é renomeado silenciosamente.

## Não alterar

Router ou links de interface.
