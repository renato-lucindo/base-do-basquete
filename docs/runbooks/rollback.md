# Rollback e correção progressiva

## Critérios

Use rollback do Worker quando a versão nova causar indisponibilidade ou regressão e a versão anterior for compatível com o banco atual. Para migration já aplicada, prefira uma migration aditiva de correção; nunca reverta dados ou schema destrutivamente sem intervenção humana e backup verificado.

## Preview ou staging

1. Registre commit, versão atual e versão anterior com `wrangler deployments list --env preview` e `wrangler versions list --env preview`.
2. Inspecione a versão alvo e confirme compatibilidade com as migrations presentes.
3. Execute o rollback apenas no ambiente preview, registre a nova implantação ativa e valide `/health`, página pública, login/MFA e operação afetada.
4. Restaure o head esperado por nova implantação, repita o smoke e compare os eventos `bdb.operation` pelo `correlationId`.

## Produção

1. Congele novos merges e capture evidências sem payload sensível.
2. Escolha uma das versões recentes verificadas. O comando `wrangler rollback --env production` ativa imediatamente uma nova implantação da versão escolhida e não reverte recursos externos.
3. Execute somente com autorização de release pela `main` protegida ou versão marcada. Confirme `/health`, público, MFA `aal2`, dados e auditoria.
4. Se a versão anterior não for compatível com o banco, mantenha o Worker atual e publique uma correção progressiva testada.

Cloudflare mantém as versões recentes, com limite operacional de 100 versões para rollback. R2, Supabase, secrets e migrations não são revertidos pelo rollback do Worker.

Referência oficial: [Cloudflare Workers rollbacks](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/).
