---
id: TSK-100
tipo: banco
dependencias: [TSK-013, TSK-023]
risco: alto
---

# Criar inscrição de equipe transacional

## Objetivo

Inserir `team_registration` de modo idempotente e autorizado.

## Escopo permitido

RPC/serviço de inscrição e teste SQL.

## Passos

1. Validar competição e equipe existentes.
2. Validar papel administrativo.
3. Inserir com estado inicial definido.
4. Mapear duplicidade para erro de domínio.
5. Retornar a inscrição criada sem escrita adicional.

## Critérios de aceite

- Repetição não cria duplicata.
- Usuário sem permissão é bloqueado.
- Nenhuma inscrição parcial existe.

## Não alterar

Elenco ou resultado final.
