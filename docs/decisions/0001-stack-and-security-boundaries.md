# ADR 0001 — Stack e fronteiras de segurança

- Status: aceito
- Data: 2026-08-21

## Contexto

A Base do Basquete precisa operar em URLs temporárias, com GitHub como fonte da verdade, Cloudflare Workers para aplicação e previews e Supabase para PostgreSQL, Auth e Storage. O frontend é totalmente não confiável.

## Decisão

- Monólito modular full-stack em TypeScript `strict`.
- React 19 e React Router em Framework Mode, usando a integração estável vigente do Cloudflare Vite plugin.
- Código organizado em `app/routes`, `app/components`, `app/contracts`, `app/domain` e `app/server`.
- Backend for Frontend no Worker; o navegador não inicializa cliente Supabase nem recebe credenciais privilegiadas.
- PostgreSQL/PLpgSQL como camada adicional de integridade, autorização, transações e idempotência.
- Zod para contratos autoritativos no servidor.
- Tailwind CSS e componentes acessíveis; Vitest, Playwright e pgTAP para testes.
- npm com lockfile, GitHub Actions, CodeQL, Dependabot e Gitleaks.
- Um único administrador na primeira temporada, sem cadastro, convites, RBAC ou gestão de usuários; rotas administrativas exigem MFA e `aal2`.
- Nenhum domínio próprio até decisão futura.

## Consequências

A implantação permanece simples e edge-native, com uma única fronteira HTTP. Integrações externas ficam atrás de adaptadores server-only. Evoluções como multiadmin, cache distribuído e OCR permanecem fora do escopo até necessidade comprovada.

## Evidência documental

A documentação atual do React Router lista Cloudflare Workers como destino oficial, e a documentação do Cloudflare Vite plugin informa suporte oficial ao React Router v8 com SSR. A versão exata das dependências será fixada pelo lockfile no WP-02.
