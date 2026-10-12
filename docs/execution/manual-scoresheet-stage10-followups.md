# PR72 — acompanhamentos separados após o gate documental

Responsável: project-maintainer. Abertura12/10/2026. Nenhuma alteração de código ou serviço executada neste registro.

| Unidade proposta | Evidência / motivo | Ação concreta e conclusão esperada |
| --- | --- | --- |
| TOOLING-AUDIT-PR72 | QA local registra seis pacotes high DEV: @cloudflare/vite-plugin, miniflare, sharp, source-map-js, undici e wrangler. Audit de produção zero; nota não bloqueante do QA para a feature | Em branch própria a partir da base estável, reproduzir audit, avaliar alcance dos advisories e versões corrigidas; atualizar versões/lockfile conforme necessário; gate, CodeQL, preview e revisão proporcional verdes. Documentar riscos remanescentes; não assumir que DEV é isento de risco |
| MANUAL-SCORESHEET-ROLLOUT-PREFLIGHT | Manifesto com62 aplicadas+6 pendentes; gerador reconcile-overlay ainda exige66 arquivos/quatro pendentes | Corrigir cálculo/mensagem do gerador; validar68 arquivos, somente seis pendentes e rejeição de inventário inesperado; renovar evidência dry-run read-only sobre histórico atualizado e revisão aplicável antes de qualquer aplicação |
| PR72-INTEGRATION-RELEASE | Checks recentes não iniciam por cobrança; schema compartilhado ainda sem feature e homologação autenticada pendente | Após capacidade restabelecida, verificar checks obrigatórios no SHA final e proteção main; executar plano de ensaio/recuperação/schema/preview do packet em unidade autorizada, depois integração protegida e release. Não fazer bypass |

Este arquivo é o acompanhamento durável no GitHub; não pressupõe issue externa criada. A unidade TOOLING não deve misturar atualização de dependências com fechamento documental ou migrations. O preflight é bloqueante para rollout; o audit DEV é nota não bloqueante do aceite funcional já emitido.

## Atualização após execução do preflight —12/10/2026

MANUAL-SCORESHEET-ROLLOUT-PREFLIGHT concluído em9acc537:68 arquivos, aliases históricos explícitos e protegidos, dry-run com exatamente seis pendentes, gate568 testes e pareceres independentes banco/QA aprovados. [Relatório e logs](manual-scoresheet-preflight-review.md). As descrições da tabela acima registram o problema na abertura; a correção não está mais pendente.

PR72-INTEGRATION-RELEASE continua pendente: cobrança recusa Actions e responsável confirmou que ainda não há ambiente isolado. Disponibilizar o ambiente antes de homologação autenticada/recuperação; não aplicar no compartilhado para compensar a ausência. TOOLING-AUDIT-PR72 permanece separado, sem alteração de dependências nesta unidade.
