# STATS-04 — Rollout e fechamento

## Estado

Em andamento na PR draft #53. Os read models anteriores continuam presentes e o carregador mantém fallback explícito quando uma publicação atual ainda não possui snapshot estatístico.

A primeira inspeção da prévia encontrou que o PostgREST sem a migration devolvia `PGRST205` e acionava o error boundary. O carregador passou a tratar exclusivamente schema ausente (`PGRST205`/`42P01`) como rollout anterior; erros de autorização ou consulta continuam bloqueantes. O gate local foi repetido após a correção: 49 arquivos/342 testes, TypeScript, build, cinco runbooks e scan de 622 arquivos aprovados.

## Gate pendente

1. executar o gate local consolidado no HEAD estável;
2. validar migration desde zero e pgTAP integral na CI;
3. validar preview com os contratos FIBA/Genius e Basketball Site, cobertura parcial, teclado, acessibilidade e larguras 320, 390, 768 e 1440 px;
4. obter parecer do `database-security-reviewer` para STATS-01/STATS-02;
5. obter parecer do `qa-reviewer` no mesmo commit;
6. manter a PR draft e não aplicar schema compartilhado, merge ou produção sem autorização explícita.
