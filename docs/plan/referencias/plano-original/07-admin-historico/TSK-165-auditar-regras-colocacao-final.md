---
id: TSK-165
tipo: banco-dominio
dependencias: [TSK-013, TSK-005]
risco: alto
---

# Auditar regras de colocação final

## Objetivo

Provar consistência entre `final_placement`, `result_status` e `result_confirmed_at`.

## Escopo permitido

Checks da tabela, migration corretiva e testes SQL.

## Passos

1. Confirmar colocação positiva.
2. Exigir colocação quando estado for `placed`.
3. Exigir nulo nos demais estados.
4. Definir timestamp somente quando resultado estiver finalizado.
5. Testar todas as combinações.

## Critérios de aceite

- Estado inválido é recusado pelo banco.
- Histórico em andamento não aparece como conquista.
- Dados incompatíveis existentes são reportados.

## Não alterar

Formulário administrativo.
