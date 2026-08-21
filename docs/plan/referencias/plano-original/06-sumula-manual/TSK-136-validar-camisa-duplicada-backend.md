---
id: TSK-136
tipo: banco
dependencias: [TSK-017, TSK-106, TSK-127]
risco: alto
---

# Bloquear camisas duplicadas no backend

## Objetivo

Impedir bypass da validação do cliente durante a transação.

## Escopo permitido

Validação do RPC/constraint e testes SQL.

## Passos

1. Validar unicidade por jogo e equipe entre relacionados ativos.
2. Preservar `"00"` versus `"0"`.
3. Executar antes de qualquer commit.
4. Retornar erro de campo padronizado.
5. Testar chamada direta ao RPC.

## Critérios de aceite

- Payload malicioso é recusado integralmente.
- Adversários podem usar o mesmo número.
- Sem dados parciais.

## Não alterar

UI.
