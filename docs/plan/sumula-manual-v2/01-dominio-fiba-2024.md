# Etapa 1 — Fechar o domínio FIBA 2024 em código puro

## Objetivo

Modelar e testar as regras de faltas FIBA 2024 sem dependência de banco ou interface.

## Atividades

- Criar `foul_rules_version = FIBA_2024`.
- Modelar separadamente tipo da falta, penalidade de lances livres e notação original.
- Criar parser versionado para `P`, `T`, `U`, `D` e marcações de técnico/banco.
- Implementar avaliação de GD para `D`, `2T`, `2U` e `T+U`.
- Implementar alvo da falta sem depender obrigatoriamente de `game_roster_slot`.
- Testar `U2` como uma falta `U` com dois LL.
- Testar normalização dos comandos.
- Testar bloqueio de novas faltas após GD.
- Não criar migration nem UI nesta etapa.

## Checkpoint

Domínio completamente testável sem banco.

## Commit esperado

`feat: model FIBA 2024 manual fouls`
