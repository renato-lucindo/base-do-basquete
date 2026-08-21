---
id: TSK-103
tipo: integracao
dependencias: [TSK-005, TSK-100, TSK-101, TSK-102]
risco: medio
---

# Mapear erros de inscrição

## Objetivo

Transformar constraints/RPCs em mensagens claras sem depender do texto do PostgreSQL.

## Escopo permitido

Mapeador de erros e testes unitários.

## Passos

1. Enumerar duplicidade de equipe, jogador em outro time, estado e autorização.
2. Mapear por código/constraint estável.
3. Preservar causa interna apenas em log seguro.
4. Fornecer ação possível ao administrador.
5. Testar erro desconhecido.

## Critérios de aceite

- UI não interpreta mensagem SQL.
- Cada erro conhecido tem código e campo.
- Erro desconhecido não é mascarado como conflito.

## Não alterar

RPCs ou componentes.
