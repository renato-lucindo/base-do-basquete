# Arquitetura e segurança obrigatórias

## Stack-base

- TypeScript em modo `strict`.
- SQL/PLpgSQL para schema, integridade, RLS e RPCs.
- React 19.
- React Router em Framework Mode, usando versão estável compatível com Cloudflare.
- Vite e Cloudflare Workers.
- Supabase PostgreSQL, Auth e Storage.
- Zod para validação autoritativa no servidor.
- Tailwind CSS e componentes acessíveis baseados em Radix UI/shadcn.
- Vitest, Playwright e testes SQL/pgTAP.
- npm com `package-lock.json`.
- GitHub Actions, CodeQL, Dependabot e varredura de segredos.

Antes de instalar, confirmar nas documentações oficiais as versões e compatibilidades atuais. Não adotar beta, RC ou recurso experimental sem necessidade comprovada. Se uma integração oficial necessária continuar beta, isolá-la atrás de adaptador e fixar sua versão.

## Forma arquitetural

Começar como monólito modular full-stack. Não criar microserviços, cache distribuído ou filas antes de necessidade mensurada, exceto o processamento futuro de documentos quando seu custo justificar isolamento.

Separar claramente:

- `app/routes`: páginas, loaders, actions e endpoints;
- `app/components`: apresentação e interação;
- `app/contracts`: schemas públicos de entrada e saída;
- `app/domain`: regras puras e cálculos;
- `app/server`: autenticação, autorização, banco, serviços e integrações;
- `supabase/migrations`: fonte da verdade do schema;
- `supabase/tests`: testes de integridade, transações e RLS.

Criar uma barreira de importação que impeça código de frontend de importar `app/server`.

## Backend autoritativo

O frontend pode renderizar, coletar entradas e duplicar validações para usabilidade. Nunca é fonte da verdade.

Devem existir no servidor e, quando aplicável, no banco:

- autenticação e autorização;
- validação completa de payload;
- regras de campeonato e jogo;
- cálculos de estatísticas e pontuação;
- transições de estado;
- controle de duplicidade e concorrência;
- idempotência;
- rate limiting;
- auditoria;
- commit transacional.

## Autenticação administrativa

- Na primeira temporada existirá uma única conta administrativa, pertencente ao responsável do projeto.
- Não oferecer cadastro público, convite, criação de outros administradores, gestão de usuários, papéis ou permissões.
- Criar a conta administrativa única por procedimento seguro no ambiente autorizado e identificá-la por registro de autorização controlado no backend/banco, nunca por informação enviada pelo frontend.
- Exigir MFA e sessão `aal2` para rotas e operações administrativas.
- Não usar `user_metadata` para autorização.
- Validar a identidade e a autorização da conta única no backend em toda operação administrativa; não confiar apenas na existência de uma sessão.
- Revogar as sessões antes de desativar ou substituir a conta administrativa.
- Auditar login e escritas administrativas essenciais.

Ficam adiados para uma fase posterior: múltiplos administradores, convites, RBAC, papéis especializados, painel de usuários, transferência de titularidade e auditoria administrativa avançada. A estrutura não deve impedir essa evolução, mas nenhum desses recursos deve ser implementado agora.

## Segredos e sessão

- Nenhuma URL interna, connection string, secret key, `service_role`, token ou credencial entra no bundle público.
- O navegador chama somente endpoints do próprio domínio.
- Manter segredos exclusivamente em GitHub, Cloudflare ou Supabase.
- Não armazenar tokens em `localStorage` ou `sessionStorage`.
- Preferir cookies seguros, `HttpOnly`, `Secure` e `SameSite` adequados.
- Não registrar cookies, senhas, tokens, códigos MFA ou cabeçalhos de autorização.
- Versionar apenas `.env.example` com placeholders.

## Supabase e PostgreSQL

- Ativar RLS em todas as tabelas de schema exposto desde sua criação.
- Revisar `GRANT` e exposição pela Data API separadamente das políticas RLS.
- `TO authenticated` sozinho não é autorização.
- Políticas de UPDATE devem cobrir SELECT, `USING` e `WITH CHECK`.
- Views expostas devem respeitar RLS, preferencialmente com `security_invoker` quando compatível.
- Preferir `SECURITY INVOKER`.
- Função `SECURITY DEFINER`, se indispensável, deve ficar em schema não exposto, usar `search_path` fixo, validar identidade/permissão e ter `EXECUTE` revogado de `PUBLIC`.
- Usar PKs, FKs, checks, uniques e índices como garantias do domínio.
- Escritas multi-tabela críticas devem ser transacionais e idempotentes.
- Aplicar migrations e testes por CI em ambiente remoto descartável ou staging, sem depender de banco local persistente.
- Executar advisors de segurança e desempenho antes do release.

## Segurança HTTP

Configurar HTTPS, HSTS, CSP restritiva, proteção contra clickjacking, `X-Content-Type-Options`, `Referrer-Policy`, CORS por allowlist, CSRF quando houver cookie, limites de payload, rate limiting e ausência de cache público para respostas autenticadas.

## Escalabilidade

- Definir volumes e metas antes de otimizar.
- Usar paginação e consultas contextuais.
- Justificar índices com consultas reais e `EXPLAIN` em staging.
- Medir p50/p95 antes de adicionar cache.
- Isolar processamento pesado somente quando necessário.
- Manter contratos e módulos que permitam trocar cache, parser ou worker sem alterar o domínio.
