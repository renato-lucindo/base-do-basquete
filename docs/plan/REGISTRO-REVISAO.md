# Registro da revisão

- Data: 2026-08-20
- Origem: `plano-fragmentado-digi-site-bask-TSK-000-bloqueada.zip`
- Situação anterior: plano dependente de repositório existente e baseline bloqueada.
- Situação nova: reconstrução greenfield autônoma e cloud-first.
- Última atualização: 2026-08-21.

## Mudanças aplicadas

- Removida a baseline antiga como gate de execução.
- Plano condensado de 156 tarefas atômicas para 14 pacotes verticais.
- Plano original preservado apenas como catálogo detalhado de requisitos.
- GitHub, Cloudflare e Supabase definidos como ambientes autoritativos.
- Autorizado uso do navegador nesses três ambientes quando necessário.
- Reduzidas solicitações de validação; adotado gate automático por pacote.
- Antecipados CI, preview, segurança e observabilidade básica.
- Adicionados backend autoritativo, proteção de segredos, RLS desde a criação e MFA administrativo.
- Reordenadas inscrições, súmula manual, estatísticas e importação PDF.
- Corrigido o escopo da importação: boxscore PDF, não súmula oficial completa.
- OCR open source registrado exclusivamente como alternativa futura.
- Nome público definido como **Base do Basquete**; domínio próprio deixado explicitamente para decisão posterior.
- Dois PDFs FIBA/Genius Sports foram incluídos originalmente como fixtures do único contrato daquele escopo. Em 2026-09-21, essa exclusividade foi superada pela inclusão do contrato versionado Basketball Site, sem autorizar parser genérico.
- Primeira temporada simplificada para uma única conta administrativa; cadastro, convites, multiadmin, RBAC, gestão de usuários e permissões foram adiados.
- Mantidos desde o início MFA, `aal2`, autorização no backend, RLS, proteção de chaves e auditoria essencial.
- Adicionado `PROMPT-PARA-EXECUCAO.md` com instrução pronta para iniciar a execução autônoma.
- Adicionados `AGENTS.md` e `HANDOFF.md` específicos da Base do Basquete para continuidade entre sessões e contas.
- Definida preservação segura do progresso: branch por WP, commits coerentes, push de WIP somente na branch de trabalho, merge após gate e produção apenas pela branch principal protegida ou versão marcada.
