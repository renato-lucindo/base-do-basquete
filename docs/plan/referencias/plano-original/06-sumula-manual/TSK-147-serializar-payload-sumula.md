---
id: TSK-147
tipo: integracao
dependencias: [TSK-126, TSK-133, TSK-136, TSK-137, TSK-140, TSK-142, TSK-145]
risco: alto
---

# Serializar payload da súmula

## Objetivo

Converter o estado do editor no contrato exato do RPC sem campos derivados conflitantes.

## Escopo permitido

Mapper puro e testes snapshot/estruturais.

## Passos

1. Incluir cabeçalho e `competition_id`.
2. Omitir slots N/A.
3. Preservar camisas textuais.
4. Ordenar períodos e eventos.
5. Incluir somente dados fonte; backend recalcula derivados.

## Critérios de aceite

- Mesmo estado gera mesmo payload.
- Não há jogador duplicado.
- Payload inválido falha antes da rede.

## Não alterar

RPC ou componentes.
