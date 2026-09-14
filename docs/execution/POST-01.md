# POST-01 — Fontes excepcionais e conflitos

Estado: `DOING`. Implementação funcional concluída na branch; gate remoto, aplicação de schema e QA de preview ainda pendentes.

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

## Gate restante

1. Abrir a PR consolidada e aguardar `gate`, `database`, preview e CodeQL no head exato.
2. Aplicar as migrations em ordem no Supabase somente depois do banco desde zero ficar verde.
3. Regenerar os tipos integrais, executar advisors e reconciliar contagens/hashes antes/depois.
4. Validar no preview AAL2 os estados sem dados, fallback aguardando, comparação e confirmação; validar negação anônima e regressão pública.
5. Atualizar este arquivo e `HANDOFF.md`; integrar somente com o gate aprovado. Produção continua dependente da `main` protegida.
