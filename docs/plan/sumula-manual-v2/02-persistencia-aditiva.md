# Etapa 2 — Persistência aditiva

## Objetivo

Persistir os novos contratos da súmula manual v2 mantendo compatibilidade com os consumidores existentes.

## Atividades

- Evoluir `foul_events`.
- Adicionar `foul_rules_version`.
- Criar representação de alvo jogador/técnico/banco/equipe.
- Criar persistência de comissão técnica e origem `captain_placeholder`.
- Criar persistência de oficiais.
- Reutilizar `is_starter` e `is_captain`.
- Migrar legado `U2` preservando a notação original.
- Adicionar RLS, grants e testes pgTAP.
- Priorizar migration aditiva e compatível com os consumidores existentes.

## Checkpoint

Banco sobe do zero e por upgrade; dados antigos continuam interpretáveis.

## Commit esperado

`feat: persist manual scoresheet v2 data`
