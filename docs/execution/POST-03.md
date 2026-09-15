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

## Estado inicial

POST-02 foi integrado pela PR #43 no commit `48511d1`. A branch própria foi criada dessa `main`. A migration vazia `20260915205114_post03_group_closure.sql` foi criada pelo Supabase CLI; nenhum schema POST-03 foi aplicado.

Próximo: desenhar e testar em rollback o snapshot autoritativo de classificação e sua resolução idempotente de vagas. A UI e as demais exceções não devem ser antecipadas antes do gate focal da primeira unidade.
