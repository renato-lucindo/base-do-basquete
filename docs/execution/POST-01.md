# POST-01 — Fontes excepcionais e conflitos

Estado: `DONE`. Implementação, banco compartilhado, gate remoto e smoke AAL2 do preview concluídos; PR #42 integrada por squash na `main` em `abb2111`.

## Escopo entregue

- Súmula manual em edição FIBA-primary é gravada como `fallback`, exige motivo de 10 a 500 caracteres e mantém `awaiting_primary_source`.
- Encerramento explícito do fallback exige singleton AAL2, motivo, lock por jogo, autoridade vigente e auditoria idempotente.
- Boxscore FIBA em edição manual-primary é marcado como `supplemental` pelo banco; a área pública manual pode projetar apenas J/PTS/PTS-J/2PC/3PC/LLC/F/GD, sem agregados avançados. GD permanece `null` sem linha do tempo manual.
- Cada submissão nova recebe snapshots canônicos imutáveis somente para os domínios suportados pela fonte.
- PDF FIBA posterior a um fallback final é processado em jogo temporário dentro da transação; o parser, a validação de elegibilidade e a revisão de nomes existentes são reutilizados. Os fatos temporários são removidos antes do commit.
- Evidências manual/FIBA são comparadas por domínio via hash canônico, com histórico idempotente e privado ao AAL2.
- A decisão administrativa exige confirmação de impacto, motivo, lock e compare-and-swap. Ambas as evidências permanecem no histórico; o candidato recusado vira `superseded`, nunca é apagado.
- Promoção FIBA reconstrói apenas domínios compatíveis, preserva a linha do tempo manual de faltas e recusa elencos incompatíveis.
- Nova tela `/admin/games/:gameId/data-conflict` apresenta fonte atual, candidata e impacto; o hub lista fallbacks aguardando PDF ou já encerrados.

## Evidência executada antes da PR

- Migrations ensaiadas juntas em `BEGIN/ROLLBACK` no Supabase compartilhado, sem persistência.
- pgTAP focado: papéis/fallback 17/17; snapshots 13/13; comparações 17/17; staging posterior 12/12; decisão 18/18; projeção rara 10/10.
- Gate local: 38 arquivos e 262 Vitest; TypeScript estrito, Biome, build Workers, cinco runbooks e varredura de segredos aprovados.
- Produção não foi alterada; permanece em `v1.1.0`.

## Gate remoto e aplicação

- PR #42 no head `76b87d2`: `gate`, banco desde zero, upload do preview e CodeQL aprovados. O banco desde zero executou também todas as regressões legadas e a concorrência dos presets.
- O primeiro ciclo de CI encontrou uma variável PL/pgSQL ambígua e fixtures sem administrador em banco vazio; o segundo encontrou o nome legado incorreto `created_at` no ledger. As correções foram aditivas e o histórico de migrations enviadas não foi reescrito.
- Nove migrations POST-01 foram aplicadas em ordem no Supabase compartilhado, de `20260914182126_post01_source_roles` a `20260914182942_post01_snapshot_fk_covering_index`.
- Os seis pgTAP focados passaram novamente no schema persistido, somando 87/87 asserções.
- Os tipos TypeScript integrais foram regenerados a partir do schema remoto e passaram no TypeScript estrito.
- RLS está habilitado e forçado nas tabelas de snapshots e comparações. O advisor de segurança não apontou vulnerabilidade nova; as três RPCs novas aparecem como `SECURITY DEFINER` intencional, com singleton AAL2, `search_path` vazio e grants somente para `authenticated`.
- O advisor de desempenho apontou inicialmente um FK composto sem cobertura. A migration aditiva final criou o índice e a nova execução deixou zero FKs sem índice; restaram apenas índices ainda não usados no volume atual.
- A reconciliação antes/depois preservou 9 jogos, 18 participantes, 48 placares de períodos, 50 vínculos de elenco, 74 estatísticas por atleta/período, 81 faltas e 2 imports, com checksums idênticos. Permanecem 9 submissões legadas, zero fallback, zero snapshot e zero comparação, sem backfill inventado.
- O preview da PR #42 confirmou `environment=preview`, classificação e jogo canônicos com HTTP 200 e redirecionamento anônimo da rota de conflito para `/admin/login`, com CSP e `nosniff`.
- Em sessão real no mesmo host, o cabeçalho confirmou `Sessão AAL2` e `/admin/games/63/data-conflict` abriu com HTTP funcional, jogo `5205822`, competição `Copa ES Ouro 2026` e estado vazio seguro (`0` domínios coincidentes e `0` divergentes). Nenhum fallback, candidato ou decisão foi criado para o smoke.
- O head documental `c68b0ff` manteve os quatro checks aprovados: `gate`, `database`, upload do preview e CodeQL.

## Fechamento

- O head final `40b8c4c` passou novamente `gate`, banco desde zero, upload do preview e análise.
- A PR #42 saiu de rascunho e foi integrada por squash na `main` em `abb2111`.
- Produção permaneceu em `v1.1.0`; nenhum deploy foi disparado pela integração.
