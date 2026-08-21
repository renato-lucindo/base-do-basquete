---
id: TSK-013
tipo: banco
dependencias: [TSK-011, TSK-006]
risco: alto
---

# Auditar `team_registrations`

## Objetivo

Garantir o vínculo único de equipe com uma edição e estados consistentes.

## Escopo permitido

Tabela `team_registrations`, índices, checks e teste SQL.

## Passos

1. Confirmar FKs para competição e equipe.
2. Confirmar unicidade `(competition_id, team_id)`.
3. Revisar estados de inscrição e resultado.
4. Verificar regras de `final_placement` sem implementá-las na UI.
5. Criar correção aditiva mínima se um critério falhar.

## Critérios de aceite

- Equipe não pode ser inscrita duas vezes na mesma edição.
- Estado inválido é recusado pelo banco.
- Exclusão acidental de histórico é bloqueada por FK apropriada.

## Não alterar

Elenco, conquistas públicas ou componentes administrativos.
