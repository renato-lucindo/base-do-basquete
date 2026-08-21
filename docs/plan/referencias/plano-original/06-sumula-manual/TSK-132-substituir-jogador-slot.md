---
id: TSK-132
tipo: frontend
dependencias: [TSK-128, TSK-131]
risco: medio
---

# Substituir jogador de um slot

## Objetivo

Permitir troca rápida apenas por outro inscrito disponível.

## Escopo permitido

Dropdown de jogador e testes.

## Passos

1. Listar atletas da equipe/edição.
2. Excluir selecionados em outros slots ativos.
3. Ao trocar, recalcular sugestão de camisa sem apagar dados confirmados indevidamente.
4. Tratar busca por nome.
5. Bloquear atleta do adversário.

## Critérios de aceite

- Um jogador não ocupa dois slots do mesmo time.
- Opções respeitam o elenco.
- Alteração é reversível antes do salvamento.

## Não alterar

Elenco persistido.
