---
id: TSK-128
tipo: dados-frontend
dependencias: [TSK-014, TSK-015, TSK-124]
risco: alto
---

# Consultar elenco da equipe na edição

## Objetivo

Listar somente atletas de `roster_entries` da inscrição selecionada.

## Escopo permitido

Consulta do editor e teste.

## Passos

1. Resolver `team_registration_id`.
2. Buscar jogadores vinculados.
3. Excluir inscrição retirada.
4. Não adicionar jogadores globais como fallback.
5. Testar o mesmo jogador em outra edição.

## Critérios de aceite

- Dropdown não contém atletas de outro time/contexto.
- Lista vazia bloqueia avanço com orientação clara.
- Chave da query inclui inscrição.

## Não alterar

Prefill ou editor de elenco.
