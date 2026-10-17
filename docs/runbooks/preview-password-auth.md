# Acesso por senha como padrão dos previews

Decisão vigente de 16/10/2026: reutilizar o Supabase dos previews existentes e evitar configuração por PR. Produção continua exigindo MFA real. A conta administrativa e sua senha permanecem as mesmas.

## Configuração única

1. Aplicar a migration aditiva de sessões de preview, após gates e revisão. Ela cria somente configuração privada e admissões de sessão, inicialmente vazias: AAL1 normal continua bloqueado.
2. Gerar uma credencial aleatória de backend e guardar apenas seu SHA-256 em private.preview_password_auth. Guardar o valor original exclusivamente no secret PREVIEW_AUTH_SECRET do Worker base-do-basquete-preview. Nunca publicar o valor no Git, logs, navegador ou chat.
3. A configuração versionada já declara PREVIEW_PASSWORD_AUTH=enabled no ambiente preview, e não no ambiente production. Uploads futuros do mesmo Worker herdam o secret único; nenhuma configuração por PR é necessária.
4. Publicar o artefato revisado em preview e entrar normalmente com e-mail e senha. O backend admite apenas a sessão Auth real da conta administrativa, mediante a credencial própria do Worker preview. A autorização dura até oito horas e termina imediatamente quando GoTrue remove a sessão no logout. Tokens preservam o AAL1 real.

O banco permanece compartilhado: operações administrativas realizadas em preview atuam nos mesmos dados já utilizados pelos previews anteriores. A exceção não concede acesso a outras identidades nem a sessões AAL1 iniciadas normalmente na produção. O Worker production continua verificando AAL2 real antes de qualquer acesso, mesmo se receber um token AAL1 admitido por preview.

## Revogação e rollback

Para revogar imediatamente a exceção no banco, executar como mantenedor em transação:

```sql
begin;
delete from private.preview_password_sessions;
delete from private.preview_password_auth;
commit;
```

Em seguida remover PREVIEW_PASSWORD_AUTH da configuração de preview e publicar novamente, ou retornar à versão anterior do Worker. Não é necessário remover tabelas ou desfazer migrations. Rotação da credencial exige substituir o hash e apagar admissões antigas na mesma transação, depois atualizar o secret de preview. Confirmar que leitura e escrita AAL1 são recusadas e que AAL2 de produção continua válido.

## Evidências exigidas

Testes focais de identidade/capacidade/sessão/TTL/logout; pgTAP integral desde zero; CI/CodeQL; revisão de banco, acessibilidade e QA; smoke de login real. O código preparado anteriormente para projeto isolado foi substituído por este contrato; o overlay manual antigo não deve ser usado.

Referências oficiais: [sessões e session_id](https://supabase.com/docs/guides/auth/sessions), [MFA](https://supabase.com/docs/guides/auth/auth-mfa).
