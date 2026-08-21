---
id: TSK-168
tipo: dados
dependencias: [TSK-165, TSK-166]
risco: alto
---

# Consultar conquistas confirmadas da equipe

## Objetivo

Retornar somente resultados finalizados, ordenados e vinculados à edição.

## Escopo permitido

Consulta/RPC pública e testes.

## Passos

1. Filtrar `result_status = placed`.
2. Exigir confirmação/timestamp conforme contrato.
3. Incluir série, ano, categoria e colocação.
4. Ordenar por ano e desempate estável.
5. Excluir retirada/desqualificação.

## Critérios de aceite

- Resultado em andamento não aparece.
- Edição correta acompanha cada conquista.
- RLS permite somente campos públicos.

## Não alterar

Componente.
