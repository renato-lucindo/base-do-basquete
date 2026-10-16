# Senha sem MFA somente no preview

Decisão do responsável em 16/10/2026: permitir e-mail e senha somente no preview. Produção continua com MFA. Esta exceção não resolve a navegação da PR77.

## Ativação manual

1. Use um **projeto Supabase exclusivo de teste**, com schema compatível e uma única conta administrativa cadastrada. Não use `yjnbemfeyjhxhomprlnm` (compartilhado) nem `payumtvegfqfejmowxiy` (QA da PR72).
2. No arquivo `scripts/preview-password-auth.sql`, substitua `__ISOLATED_PREVIEW_PROJECT_REF__` pelo identificador público de 20 letras desse projeto. Execute o conteúdo no SQL Editor **desse projeto de teste**. O script modifica somente a decisão central de autorização; não cria tabelas nem apaga fatores. É uma configuração específica de preview, fora das migrations de produto.
3. Configure o Worker exclusivamente de preview com os bindings do projeto de teste e `PREVIEW_PASSWORD_AUTH_PROJECT_REF=<mesmo identificador>`. `SUPABASE_URL` deve ser exatamente `https://<identificador>.supabase.co` e `APP_ENV` deve ser `preview`. Configuração divergente é bloqueada. Não envie credenciais pelo chat.
4. Após os gates e a revisão, publique somente esse preview. Entre com e-mail e senha; confirme que o painel abre e que consegue ler e gravar dados de teste. A sessão permanece com `aal1` real. O banco continua recusando outras contas, emissores e métodos de entrada.

Não foi executada nenhuma etapa remota nesta preparação. A proibição anterior de migrations remotas e deploy permanece até autorização específica. A existência de uma flag no Worker não basta para autorizar o banco.

## Voltar ao MFA

Remova o binding `PREVIEW_PASSWORD_AUTH_PROJECT_REF` do Worker e publique novamente o preview. Isso restaura o fluxo MFA no backend. Para também restaurar o banco de teste, execute nele:

```sql
create or replace function private.is_admin_aal2()
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select (select private.is_admin())
    and coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2';
$$;
comment on function private.is_admin_aal2() is null;
```

## Validação e entrega

O delta é restrito ao guard central, login, mensagem de segurança, testes e overlay manual. Não há migration automática, credencial privilegiada no navegador, alteração de senha ou remoção de fatores. RLS, autorização por identidade, CSRF, cookies e transações permanecem.

Os testes devem cobrir configuração de produção/preview, emissor, método de senha, administrador/outra conta/anônimo, leitura/escrita com RLS e restauração de MFA. Banco/segurança, acessibilidade e QA independentes são exigidos antes da ativação. Evidências reais ficam no HANDOFF.

Referência: [MFA e níveis de autenticação no Supabase](https://supabase.com/docs/guides/auth/auth-mfa).
