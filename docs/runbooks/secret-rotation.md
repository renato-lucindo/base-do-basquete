# Revogação e rotação de segredo

## Regras

- Nunca cole o valor anterior ou novo em issue, PR, log, comando registrado, `HANDOFF.md` ou arquivo do repositório.
- Identifique apenas o nome, ambiente, consumidor e horário da rotação.
- Se houver exposição confirmada, revogue primeiro e aceite a breve indisponibilidade. Sem exposição, configure o novo valor, implante, valide e então revogue o antigo.

## Procedimento

1. Restrinja o incidente e identifique os consumidores pelo nome: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` ou `SESSION_SECRET`.
2. Gere a substituição no provedor com o menor escopo. Para Cloudflare, limite-a à conta e a Workers Scripts; para GitHub, atualize o Actions secret da dependência correspondente.
3. Para o Worker, grave com `wrangler secret put NOME --env preview` e, somente durante release autorizado, `--env production`. O valor deve entrar pelo prompt seguro.
4. Reimplante o mesmo commit confiável no ambiente afetado. Rotacionar `SESSION_SECRET` encerra todas as sessões administrativas seladas e exige novo login/MFA; isso é esperado.
5. Revogue a credencial anterior no provedor, valide `/health`, CI/CD e login `aal2`, e examine logs por falhas residuais.
6. Execute `npm run scan:secrets`. Se um segredo entrou no Git, revogá-lo é obrigatório; reescrita destrutiva de histórico exige decisão humana explícita.

## Supabase

A chave publicável não concede privilégio administrativo e continua protegida por RLS, mas deve ser substituída se houver abuso. Chaves secretas/service role não pertencem ao Worker nem a este repositório. Mudanças nas chaves do projeto devem seguir a rotação suportada pelo painel e ser ensaiadas em preview antes de produção.

Referências oficiais: [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/) e [Supabase API keys](https://supabase.com/docs/guides/api/api-keys).
