---
id: TSK-015
tipo: banco
dependencias: [TSK-014, TSK-005, TSK-006]
risco: alto
---

# Bloquear jogador em duas equipes na mesma edição

## Objetivo

Aplicar no banco a regra que impede um jogador de integrar dois `team_registrations` da mesma competição.

## Escopo permitido

Função/trigger ou modelo equivalente, migration aditiva e teste SQL isolado.

## Passos

1. Detectar conflitos existentes sem corrigi-los automaticamente.
2. Escolher mecanismo transacional seguro para validar a competição da inscrição.
3. Bloquear `INSERT` e mudanças de inscrição/jogador.
4. Retornar código de erro estável definido em `TSK-005`.
5. Testar concorrência e permitir equipes diferentes em edições diferentes.

## Critérios de aceite

- Conflito na mesma edição é recusado atomicamente.
- A mesma pessoa pode mudar de equipe entre edições.
- Dois pedidos simultâneos não burlam a regra.

## Não alterar

Cadastro global do jogador ou `players.team_id`.
