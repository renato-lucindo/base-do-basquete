# Política de segurança

Não abra issues públicas com credenciais, tokens, cookies, dados pessoais ou detalhes exploráveis. Reporte vulnerabilidades pelo canal privado de segurança do repositório.

## Regras do projeto

- Segredos ficam exclusivamente nos cofres do GitHub, Cloudflare ou Supabase.
- `.env.example` contém somente nomes e placeholders.
- O frontend não importa módulos de `app/server` nem SDK administrativo.
- Operações administrativas exigem identidade autorizada e sessão `aal2` no backend.
- RLS e integridade do PostgreSQL são testadas para acesso anônimo, autenticado não autorizado e administrativo.
- Logs omitem tokens, cookies, senhas, códigos MFA, cabeçalhos de autorização e payloads sensíveis.
