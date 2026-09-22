# STATS-01 — Snapshot estatístico por publicação

## Entrega

A migration `20260922141453_stats_public_player_snapshot.sql` cria um cabeçalho estatístico e linhas imutáveis por publicação, escopo, inscrição e atleta. O materializador executa na mesma transação da publicação e congela perfil, contrato, classificação estrutural, cobertura, totais anuláveis e mínimo por 30 minutos.

O escopo interno canônico `knockout` é publicado como `playoffs`. Jogos sem classificação estrutural entram somente em `all`. Os read models anteriores permanecem disponíveis durante esta versão de rollback.

`fouls_received` é anulável e projetado apenas no `game_total` canônico da submissão FIBA/Genius confirmada e autoritativa. Trocar a autoridade para uma fonte sem FR limpa o valor anterior para `null`; linhas de período nunca repetem o total do jogo. O contrato Basketball Site preserva `null`; ausência não é convertida em zero. O fingerprint estatístico é separado do hash editorial e participa da decisão idempotente de republicação.

## Segurança

As duas tabelas públicas usam `ENABLE/FORCE ROW LEVEL SECURITY`, concedem somente `SELECT` a `anon` e `authenticated` e expõem ao público apenas a publicação atual de competição publicada ou arquivada. Helpers ficam em `private`, com `search_path` vazio e execução revogada. Triggers impedem alteração ou remoção de snapshots.

## Evidência

- commit inicial: `dd6a778`;
- PR draft: #53;
- CI inicial: gate, database desde zero/pgTAP integral, preview upload e CodeQL aprovados;
- Supabase compartilhado e produção: inalterados;
- tipos TypeScript sincronizados localmente com a migration; regeneração autoritativa fica condicionada à futura aplicação autorizada do schema.
