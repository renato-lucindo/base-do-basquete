# Preview humano QA com dispensa temporária de MFA

O responsável solicitou e confirmou em 13/10/2026 a dispensa **somente no preview local e QA**. A conta criada pelo próprio responsável foi vinculada ao singleton QA depois de confirmar email e login real. Nenhuma senha foi consultada ou alterada.

## Escopo e isolamento

- Projeto autorizado: `payumtvegfqfejmowxiy`; URL `https://payumtvegfqfejmowxiy.supabase.co`.
- Origem única: `http://127.0.0.1:5173`; clientes loopback; modo development, APP_ENV preview.
- Fim da dispensa: **14/10/2026 às 12h de Brasília (15:00 UTC)**. Launcher fecha e banco deixa de aceitar AAL1 após esse horário.
- A função QA continua exigindo identidade do singleton. AAL1 só é aceito com issuer JWT exato do QA e lease válida. Anon, não admin, issuer compartilhado e lease expirada não recebem exceção.
- Login, senha, cookie HttpOnly/Secure, CSRF, RLS, grants, singleton e regras de domínio permanecem ativos. Não há promoção artificial do JWT para AAL2.
- Fontes `app/`, migrations da feature, configuração Vite normal e workflows permanecem intactos. O launcher usa um plugin de desenvolvimento explícito que transforma em memória somente o guard administrativo e o redirect de login. O build/deploy normais não carregam esse plugin.
- A diferença temporária no QA impede usar esse preview como evidência da obrigatoriedade de MFA em produção. SQL/Auth/MFA previamente aprovados permanecem evidências históricas do schema original, não evidência do estado temporário.

## Execução e restauração

1. Conferir `.dev.vars` ignorado: SUPABASE_URL exata do QA, SUPABASE_PUBLISHABLE_KEY do QA e SESSION_SECRET aleatória local. Nunca inserir service_role na aplicação.
2. Aplicar [enable-qa-only.sql](evidence/manual-scoresheet-local-aal1/enable-qa-only.sql) **somente no projeto QA** pelo conector com project_id explícito. Registro operacional QA separado do diretório de migrations de produção.
3. Parar o dev server anterior e executar `node --conditions=development scripts/start-isolated-qa-preview.mjs --allow-qa-aal1`. Nenhuma opção de host/alvo alternativa é aceita.
4. Entrar com a conta QA criada pelo responsável. A sessão permanece AAL1 e deve abrir a administração e o wizard sem MFA.
5. Depois do teste, parar launcher e aplicar [restore-qa-only.sql](evidence/manual-scoresheet-local-aal1/restore-qa-only.sql) no mesmo projeto QA; voltar ao `npm run dev` normal. Confirmar admin AAL1 negado, AAL2 autorizado e nonadmin negado. Mesmo sem restauração imediata, a lease expira automaticamente.

## REVIEW_PACKET

```text
WORK_UNIT: MANUAL-SCORESHEET-QA-LOCAL-AAL1
BRANCH: codex/manual-stage4-v3-review; upstream origin/codex/manual-scoresheet-v2; PR72
BASE_COMMIT: 106aedd
HEAD_COMMIT: commit que contém este packet; fixar na solicitação independente
OBJETIVO: permitir teste humano sem MFA exclusivamente no QA/local explicitamente autorizado
CRITERIOS_DE_ACEITE: login/admin preservados; loopback+QA+expiry; anon/nonadmin negados; fontes da feature inalteradas; restauração reproduzível
ESCOPO: launcher separado, regressões, SQL operacional QA, evidências e HANDOFF
ESCOPO_NEGATIVO: aplicação/SQL funcional original, compartilhado, cobrança, main, merge e produção
ARQUIVOS_ALTERADOS: scripts/start-isolated-qa-preview{,.test}.mjs; docs/execution/manual-scoresheet-local-aal1.md; docs/execution/evidence/manual-scoresheet-local-aal1/*.sql; HANDOFF.md
MIGRATIONS: nenhuma em supabase/migrations; alteração temporária no QA somente após revisão
RISCOS_CONHECIDOS: QA aceita admin AAL1 até expiração; este preview não comprova MFA
TESTES_EXECUTADOS: node --test scripts/start-isolated-qa-preview.test.mjs 3/3 PASS; gate consolidado e validação SQL a registrar
EVIDENCIAS: arquivos SQL, launcher e regressões; resultados reais serão anexados
AMBIENTE_VALIDADO: Windows/Node local; Supabase QA (execução pendente de revisão)
RISK_LEVEL: CRITICO
RISK_JUSTIFICATION: exceção temporária de autorização explicitamente solicitada, sem alteração em produção
REVIEW_DECISIONS: database-security-reviewer REQUIRED; qa-reviewer REQUIRED; estatística/UI/boxscore sem mudança funcional
REQUIRED_REVIEWERS: database-security-reviewer, qa-reviewer
WAIVERS: especialistas não afetados; não renovar gates remotos indisponíveis por cobrança para executar teste local, sem liberar merge
REVIEW_APPROVER: project-maintainer
WRITE_LOCK_OWNER: project-maintainer
```

## Resultado

Preparação em andamento. Não registrar aprovação nem execução remota antecipada.
