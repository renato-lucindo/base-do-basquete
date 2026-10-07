# Etapa 7 — Lançamento rápido de faltas

## Objetivo

Integrar o parser FIBA 2024 ao fluxo rápido de faltas, preservando semântica, penalidade e regras de GD.

## Atividades

- Integrar o parser da Etapa 1.
- Aceitar entradas como `12U2`, `12 U2` e variações em minúsculas.
- Trabalhar por período e equipe.
- Aplicar GD sobre o tipo da falta.
- Bloquear novas faltas do atleta após GD.
- Não rejeitar pontuação do mesmo período por ausência de cronologia global.
- Tratar faltas de banco/comissão sem atleta artificial.
- Cobrir feedback acessível para entradas aceitas e rejeitadas.

## Checkpoint

Cenários FIBA 2024 e feedback acessível cobertos por testes.

## Commit esperado

`feat: add FIBA 2024 quick foul entry`
