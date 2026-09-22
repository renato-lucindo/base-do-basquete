# STATS-04 — Rollout e fechamento

## Estado

Em andamento na PR draft #53. Os read models anteriores continuam presentes e o carregador mantém fallback explícito quando uma publicação atual ainda não possui snapshot estatístico.

A primeira inspeção da prévia encontrou que o PostgREST sem a migration devolvia `PGRST205` e acionava o error boundary. O carregador passou a tratar exclusivamente schema ausente (`PGRST205`/`42P01`) como rollout anterior; erros de autorização ou consulta continuam bloqueantes. O gate local foi repetido após a correção: 49 arquivos/342 testes, TypeScript, build, cinco runbooks e scan de 622 arquivos aprovados.

No HEAD funcional `8e2fa01`, os quatro checks remotos passaram: `gate` em 50 s, `database` desde zero/pgTAP integral em 2 min 17 s, `upload` com smoke em 1 min 24 s e CodeQL em 3 min 8 s. A prévia `pr-53-base-do-basquete-preview` confirmou o fallback legado sem erro e sem overflow global em 320, 390, 768 e 1440 px; a tabela manteve overflow próprio e `tabindex=0`. O override de viewport foi restaurado.

A interface `boxscore-v2` não pode ser exercitada nessa prévia antes da migration existir no Supabase compartilhado. Aplicá-la continua fora da autorização desta unidade; portanto, a validação visual do novo componente permanece pendente e não é substituída pela confirmação do fallback.

O primeiro parecer QA no HEAD `4c0cb55` foi `BLOCK_RELEASE`: apontou base completa incorreta no review packet, ausência inevitável de QA real da UI, ausência do parecer especializado de banco e teste de troca de autoridade apenas estrutural. A base foi reconciliada para `fe642353992f50079233d5c39c6adb8ec6da142b`; a fixture FIBA agora troca efetivamente para uma submissão sem FR, comprova limpeza do `game_total`, preserva uma linha de período e restaura/reprojeta a autoridade FIBA. Os bloqueios externo e visual permanecem declarados.

No HEAD `3c71324`, gate, banco desde zero/pgTAP integral, preview/smokes e CodeQL passaram. A revisão QA incremental de 2026-09-22 12:39 -03:00 confirmou como resolvidos o hash da base e o teste comportamental, mas manteve `BLOCK_RELEASE` por dois gates externos: parecer obrigatório do `database-security-reviewer` indisponível nesta sessão e QA real da UI dependente de migration não autorizada. A PR permanece draft por desenho.

O primeiro commit exclusivamente documental do parecer chegou à branch remota como `9041652`, mas a API da PR permaneceu temporariamente indexada no pai funcional `3c71324`. Essa divergência de identidade também bloqueia o gate até a referência da PR acompanhar a branch, sem reescrita de histórico.

## Gate pendente

1. obter parecer do `database-security-reviewer` para STATS-01/STATS-02;
2. obter parecer do `qa-reviewer` no mesmo commit;
3. obter autorização explícita para aplicar a migration no Supabase compartilhado;
4. regenerar tipos a partir do schema aplicado e validar a interface nova com FIBA/Genius, Basketball Site, cobertura parcial, teclado, acessibilidade e larguras 320, 390, 768 e 1440 px;
5. manter a PR draft e não integrar nem publicar produção sem autorização explícita.
