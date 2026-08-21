---
id: TSK-166
tipo: banco
dependencias: [TSK-121, TSK-165]
risco: alto
---

# Confirmar resultado da equipe

## Objetivo

Atualizar colocação e estado de forma autorizada e atômica.

## Escopo permitido

RPC/serviço de resultado e testes SQL.

## Passos

1. Receber inscrição, estado e colocação opcional.
2. Validar admin.
3. Aplicar regras de `TSK-165`.
4. Definir timestamp no banco.
5. Retornar registro atualizado.

## Critérios de aceite

- Update genérico não burla regras.
- Erro não deixa estado parcial.
- Timestamp não é controlado pelo cliente.

## Não alterar

UI ou consultas públicas.
