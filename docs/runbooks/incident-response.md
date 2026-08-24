# Resposta a incidentes

## Objetivo

Restabelecer segurança, integridade e disponibilidade sem copiar dados pessoais, cookies, tokens, payloads ou credenciais para tickets e conversas.

## Triagem

1. Registre horário, ambiente, sintoma e o `correlationId` retornado no cabeçalho `X-Correlation-ID`.
2. Classifique: `SEV-1` para vazamento, corrupção ou indisponibilidade total; `SEV-2` para função crítica degradada; `SEV-3` para impacto contornado.
3. Em suspeita de integridade, interrompa novas escritas pelo mecanismo mais estreito disponível. Não apague nem altere evidências.
4. Consulte Workers Logs no Cloudflare e Auth/API/Postgres Logs no Supabase pelo intervalo e `correlationId`. Previews por URL de versão não oferecem tail; use o Worker de staging implantado para investigação ao vivo.
5. Relacione os eventos `bdb.operation` pelo identificador, operação, resultado, status e duração. Os logs não devem conter caminho completo, query string, formulário, nome do PDF, e-mail ou payload.

## Contenção e recuperação

- Credencial suspeita: siga `secret-rotation.md`.
- Versão do Worker suspeita: siga `rollback.md`.
- Perda ou corrupção de dados: preserve o banco, restrinja escritas e siga `backup-restore.md`.
- Falha funcional sem risco aos dados: prefira correção aditiva em nova branch e PR; produção continua saindo apenas de `main` ou versão marcada.

## Validação e encerramento

Valide `/health`, uma página pública, login com MFA `aal2`, a operação afetada e a reconciliação das tabelas/auditoria correspondentes. Registre causa, impacto, janela, correção, versão implantada e prevenção sem incluir segredos. Só encerre depois de confirmar estabilidade e atualizar o `HANDOFF.md`.

Referências oficiais: [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) e [Supabase Logs](https://supabase.com/docs/guides/platform/logs).
