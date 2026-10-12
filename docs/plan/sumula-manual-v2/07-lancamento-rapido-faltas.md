# Etapa 7 — Lançamento rápido de faltas

## Objetivo

Integrar o parser FIBA 2024 ao fluxo rápido de faltas, preservando semântica, penalidade e regras de GD.

## Atividades

- Integrar o parser da Etapa 1.
- Aceitar entradas como `12U2`, `12 U2` e variações em minúsculas.
- Trabalhar por período e equipe.
- Agrupar faltas Q4/OT no período 4, sem distinguir Q4 de qualquer OT, com sequência única e pontuação separada por período.
- Aplicar GD sobre o tipo da falta.
- Bloquear novas faltas do atleta após GD.
- Não rejeitar pontuação do mesmo período por ausência de cronologia global.
- Aplicar essa permissão a todo o grupo Q4/OT quando a GD estiver nele. GD em Q1–Q3 continua bloqueando pontuação posterior, inclusive OT. A regra também deve orientar a integração autoritativa da Etapa 8.
- Tratar faltas de banco/comissão sem atleta artificial.
- Cobrir feedback acessível para entradas aceitas e rejeitadas.

## Checkpoint

Cenários FIBA 2024 e feedback acessível cobertos por testes.

## Commit esperado

`feat: add FIBA 2024 quick foul entry`
