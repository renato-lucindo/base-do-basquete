# POST-03 — Exceções esportivas

Estado: `DOING` na branch `feature/post-03-sports-exceptions`.

## Escopo

- encerramento validado de classificatória/grupo com snapshot imutável;
- W.O., desistência e decisão administrativa sem jogo ou placar fictício;
- correções e emendas com ponto de corte, antes/depois, supersessão e ativação atômica.

## Invariantes

- somente resultado oficial ativo e validado pode alimentar classificação e progressão;
- tabela provisória não resolve vaga futura;
- jogo iniciado ou concluído nunca é reescrito silenciosamente;
- toda mutação exige administrador singleton AAL2, CSRF/mesma origem na rota, transação, idempotência e auditoria;
- revisões ativas e históricas permanecem imutáveis; correções criam nova evidência ou revisão;
- nenhum fluxo fabrica jogo, placar ou resultado;
- migrations são aditivas e produção permanece em `v1.1.0`.

## Ordem interna

1. snapshot e encerramento validado de grupo, com resolução das vagas posteriores;
2. W.O./desistência/decisão administrativa sem placar fictício;
3. emenda antes de dependente iniciado e bloqueio/ponto de corte após início;
4. UI AAL2 de ação secundária e impacto;
5. gate consolidado, aplicação persistente, tipos, advisors, reconciliação e preview.

## Unidade 1 — encerramento autoritativo de grupo

Implementada localmente na migration aditiva
`20260915205114_post03_group_closure.sql`:

- preview server-side com `sourceHash`, resultados oficiais e classificação;
- fechamento AAL2 idempotente por UUID e CAS do hash;
- exigência de jogo final, submissão primária ativa e autoridade `official_result`;
- snapshot imutável das fontes e linhas de classificação;
- ordem completa sem duplicidade e proibição de menos vitórias acima de mais vitórias;
- justificativa obrigatória quando existe empate em vitórias;
- resolução opcional de slots posteriores ainda indefinidos, sem criar jogo;
- RLS, privilégio mínimo e auditoria essencial.

O pgTAP focal `post03_group_closure.test.sql` possui 29 asserções. O ensaio no
Supabase compartilhado ocorreu dentro de uma única transação e terminou em
`ROLLBACK`: 29/29 passaram. A verificação posterior confirmou ausência da nova
tabela e zero auditorias de fechamento; nenhum schema ou dado POST-03 foi
persistido.

O gate local completo passou fora da restrição de subprocessos do sandbox:
formatação, lint, tipos, 290 testes Vitest, cinco runbooks, build e varredura de
segredos em 566 arquivos. O CI ainda executará o banco do zero antes de qualquer
aplicação compartilhada.

Próximo: enviar a unidade ao CI, corrigir qualquer regressão do banco do zero e,
somente após o gate verde, avançar para W.O./desistência/decisão administrativa.

## Unidade 2 — decisões esportivas sem placar fictício

Implementada localmente na migration aditiva
`20260915222213_post03_administrative_results.sql`:

- tipos `walkover`, `withdrawal` e `administrative_decision`;
- preview AAL2 de impacto e RPC transacional idempotente;
- vencedor/perdedor derivados dos participantes bloqueados, com motivo obrigatório;
- cancelamento preservado de jogo agendado ainda não iniciado, sem criar jogo ou placar;
- progressão pelo vencedor e exclusão mútua com resolução por resultado oficial;
- corte rígido quando o próprio jogo ou um dependente já começou;
- integração ao fechamento de grupo: vitória/derrota contam, pontos permanecem zero;
- snapshot imutável, RLS e auditoria essencial.

O pgTAP focal `post03_administrative_results.test.sql` possui 33 asserções e
passou 33/33 no Supabase dentro de uma transação revertida. A migration de grupo
foi carregada antes dela na mesma transação para reproduzir a ordem real, sem
persistir schema ou dados.

O gate local da unidade também passou: formatação, lint, tipos, 290 testes
Vitest, cinco runbooks, build e varredura de segredos em 568 arquivos.

Commit `61911a9` enviado à PR draft #44. O ciclo remoto passou integralmente:
gate, banco do zero (incluindo os dois pgTAPs POST-03), upload do preview e
CodeQL.

Próximo: correções e emendas com ponto de corte, antes/depois, ativação atômica
e supersessão sem apagar histórico.

## Unidade 3 — correções e emendas versionadas

Implementada localmente na migration aditiva
`20260916095002_post03_ruleset_amendments.sql`:

- preview AAL2 do impacto e do ponto de corte;
- correção somente antes de qualquer jogo dependente iniciado ou com submissão;
- clone do grafo ativo na mesma edição, sem editar o grafo consumido;
- cópia explícita das atribuições por seed e dos resultados anteriores;
- snapshots imutáveis `before`/`after` e motivo obrigatório;
- cancelamento preservado de jogos dependentes ainda não iniciados;
- troca atômica: revisão anterior `superseded`, clone corrigido `active`;
- participantes futuros recalculados sem criar novos jogos;
- bloqueio integral depois do ponto de corte, sem draft parcial;
- RLS, idempotência e auditoria essencial.

O pgTAP focal `post03_ruleset_amendments.test.sql` possui 34 asserções e
passou 34/34 no Supabase após carregar as três migrations POST-03 na ordem real,
dentro de uma única transação revertida. A reconciliação posterior confirmou
ausência da tabela e zero auditorias de emenda no banco compartilhado.

O gate local da unidade passou: formatação, lint, tipos, 290 testes Vitest,
cinco runbooks, build e varredura de segredos em 570 arquivos.

Próximo: gate completo/CI da unidade e implementação da UI AAL2 para preview e
confirmação secundária das três operações.
