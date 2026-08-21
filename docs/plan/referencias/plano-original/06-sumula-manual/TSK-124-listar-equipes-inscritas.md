---
id: TSK-124
tipo: dados-frontend
dependencias: [TSK-013, TSK-123]
risco: alto
---

# Listar equipes inscritas na edição

## Objetivo

Popular mandante e visitante somente com `team_registrations` válidos.

## Escopo permitido

Consulta de equipes do cabeçalho e teste.

## Passos

1. Filtrar por `competition_id`.
2. Excluir inscrições retiradas conforme contrato.
3. Ordenar por nome.
4. Impedir seleção da mesma equipe nos dois lados.
5. Limpar equipes ao trocar categoria.

## Critérios de aceite

- Equipe global não inscrita não aparece.
- Mandante e visitante são diferentes.
- Consulta não usa `players.team_id`.

## Não alterar

Criação de equipe ou RPC do jogo.
