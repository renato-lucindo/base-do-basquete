---
id: TSK-014
tipo: banco
dependencias: [TSK-013]
risco: alto
---

# Auditar `roster_entries`

## Objetivo

Garantir que o vínculo do jogador pertença à inscrição de equipe correta.

## Escopo permitido

Tabela `roster_entries`, FKs, índices e teste SQL.

## Passos

1. Confirmar FKs para inscrição e jogador.
2. Confirmar unicidade dentro da mesma inscrição.
3. Verificar política de remoção e preservação histórica.
4. Provar consultas por competição, equipe e jogador.
5. Corrigir somente a garantia ausente.

## Critérios de aceite

- O mesmo jogador não se repete na mesma inscrição.
- Consultas não dependem de `players.team_id` para histórico.
- Histórico não é apagado em cascata indevida.

## Não alterar

Regra entre equipes diferentes; ela pertence à `TSK-015`.
