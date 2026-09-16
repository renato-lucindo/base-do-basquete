# POST-04 — Enforcement e fechamento integral

Estado: `DOING` na branch `feature/post-04-enforcement-closure`.

## Entrada humana medida em 16/09/2026

O Supabase compartilhado ainda não está pronto para enforcement:

- 2 edições com naipe pendente;
- 2 edições com perfil de dados pendente;
- 43 atletas com revisão privada de elegibilidade pendente;
- `enforcementReady=false`.

As edições pendentes são as competições 1 e 9. Nenhum valor será inferido de
nome, equipe, categoria ou estatística. O responsável informou que fará as
revisões posteriormente.

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

A PR draft #45 está no head `9d10913` com os quatro checks verdes:

- gate de aplicação aprovado;
- banco reconstruído desde zero com 37 arquivos e 910 asserções pgTAP;
- concorrência aprovada para primeira criação idempotente e disputa pela última
  vaga de semifinal;
- preview/upload e CodeQL aprovados.

O ensaio no Supabase compartilhado continua sendo apenas transacional e
auto-bloqueado por `BR100`; a consulta posterior confirmou que o schema não foi
alterado. Produção permanece em `v1.1.0`; nenhuma migration POST-04 foi aplicada.
