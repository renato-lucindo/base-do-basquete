# POST-04 — Enforcement e fechamento integral

Estado: `DOING` na branch `feature/post-04-enforcement-closure`.

## Entrada humana medida em 16/09/2026

O Supabase compartilhado ainda não está pronto para enforcement. A fotografia
somente leitura de `2026-09-16T15:34:34Z` registrou:

- 2 edições com naipe pendente;
- 2 edições com perfil de dados pendente;
- 43 atletas com revisão privada de elegibilidade pendente;
- 0 atletas sem linha privada correspondente;
- `enforcementReady=false`.

As edições pendentes são as competições 1 e 9. Nenhum valor será inferido de
nome, equipe, categoria ou estatística. O responsável informou que fará as
revisões posteriormente.

O inventário pré-enforcement contém 5 competições, 44 jogadores, 44 perfis
privados, 9 jogos, 18 participantes, 48 placares por período, 50 slots de
elenco, 74 linhas de estatísticas por período, 81 faltas, 2 importações, 4
publicações e 6 revisões de regulamento. O relatório de autoridade de dados está
pronto (`ready=true`) com 9 submissões, 28 autoridades, 4 submissões ativas e 5
revisões de seed legado.

Os hashes esportivos de referência são:

- placares por período: `847fefb7c39119447f3ae10eb0419b81`;
- pontos dos jogadores: `957293c09608e9af9fa5cddaddf69c35`;
- relacionados/DNP: `9391932eaa5ffe47e5b4bd6e4d3629ba`;
- faltas: `132d68ea72222f1bd29085a9f4537205`;
- desqualificações: `92e018e0110ffc5cbb510f575323694c`;
- hashes de importação: `85419d16fa779a4db25981803e118e58`.

A consulta reproduzível está em
`supabase/reconciliation/post04_pre_enforcement_baseline.sql`. Ela retorna
somente contagens, dados públicos de classificação e hashes, sem valores
privados de elegibilidade.

## Fila administrativa de fechamento

A rota AAL2 `/admin/review-queues` consome exclusivamente o relatório
`admin_get_classification_backfill_report` já protegido pelo banco. Ela mostra:

- contagens de naipe, perfil e elegibilidade pendentes;
- links diretos para as revisões das competições;
- links diretos para os formulários privados dos atletas;
- somente nomes públicos, IDs, contagens, flags e evidências factuais.

O parser server-side usa uma allowlist e descarta qualquer campo não previsto;
nenhum valor privado de elegibilidade é transportado para a tela. Relatório
inválido ou incompleto resulta em 503, sem apresentar um gate parcial como se
fosse confiável. O gate local aprovou 44 arquivos/302 testes Vitest, TypeScript
estrito, Biome, build cliente/SSR, runbooks e varredura de 586 arquivos.

## Unidade preparatória — enforcement autocondicionado

A migration `20260916123000_post04_final_profile_enforcement.sql` foi preparada,
mas não será aplicada ao ambiente compartilhado enquanto qualquer fila estiver
pendente. Ela:

- aborta atomicamente com contagens sem valores privados quando a fila não está
  zerada;
- torna obrigatórios naipe, perfil versionado e metadados de validação;
- restaura a unicidade final série + categoria + naipe + ano;
- torna obrigatório o valor privado de elegibilidade e mantém os campos
  legados de revisão, sempre falsos;
- substitui a criação automática de linha privada vazia por FK circular
  diferida, permitindo que os fluxos autorizados gravem jogador e perfil na
  mesma transação;
- preserva colunas, histórico, IDs, jogos, submissões e publicações.

O pgTAP focal cobre as invariantes, o fluxo AAL2 de criação e as negações de
privacidade. As fixtures determinísticas e suítes funcionais foram migradas
para perfis finais explícitos. Quatro suítes de rollout que criavam
deliberadamente valores nulos foram preservadas em `supabase/legacy-rollout-tests/`;
seus estados deixaram de ser representáveis, e a cobertura sucessora está
documentada no README desse diretório. Antes de qualquer aplicação persistente
ainda serão necessários: CI desde zero, relatório zerado e autorização humana
explícita.

## Gate descartável

A PR draft #45 está no head funcional `9d10913` e recebeu somente documentação
de evidência depois dele. Os quatro checks estão verdes:

- gate de aplicação aprovado;
- banco reconstruído desde zero com 37 arquivos e 910 asserções pgTAP;
- concorrência aprovada para primeira criação idempotente e disputa pela última
  vaga de semifinal;
- preview/upload e CodeQL aprovados.

O ensaio no Supabase compartilhado continua sendo apenas transacional e
auto-bloqueado por `BR100`; a consulta posterior confirmou que o schema não foi
alterado. Produção permanece em `v1.1.0`; nenhuma migration POST-04 foi aplicada.

## Advisors pré-enforcement

A leitura de `2026-09-16T15:36:06Z` não encontrou erro. Permanecem avisos já
conhecidos e não introduzidos pelo POST-04:

- `INFO`: 8 tabelas do schema privado com RLS e nenhuma policy; o schema não é
  exposto ao cliente e o acesso autorizado ocorre por funções restritas;
- `WARN`: 37 RPCs administrativas `SECURITY DEFINER` executáveis por
  `authenticated`; cada fluxo permanece responsável por exigir o administrador
  singleton em AAL2 e fixar o `search_path`;
- `WARN`: proteção contra senhas vazadas desabilitada, dependente do plano;
- `INFO`: 101 índices ainda sem uso observado no banco de baixo volume; não há
  evidência para remoção antes de carga representativa.

Referências de remediação: [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[funções SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[proteção de senha](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
e [índices sem uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
