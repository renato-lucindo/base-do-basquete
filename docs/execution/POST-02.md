# POST-02 — Ciclo administrativo e editor completo

Estado: `DOING` na branch `feature/post-02-admin-cycle`.

## Escopo

- política transacional que remove somente inscrição provisória sem histórico, retira quando já existe histórico competitivo e bloqueia dependências incompatíveis;
- UI AAL2 com ação secundária, confirmação, consequências claras, foco e retorno ao contexto da equipe;
- clonagem profunda e independente de template ou edição anterior, filtrada por série, categoria e naipe;
- editor estrutural apenas para revisões draft, com capacidade, origens e erros validados também no servidor/banco.

## Invariantes

- nenhuma operação exclui o cadastro global da equipe ou apaga histórico competitivo;
- revisões ativas e publicadas permanecem imutáveis;
- toda escrita exige administrador singleton AAL2, mesma origem/CSRF, transação, idempotência e auditoria;
- frontend apresenta decisões, mas não determina política, capacidade nem validade estrutural;
- migrations são aditivas e colunas legadas permanecem preservadas;
- produção continua em `v1.1.0` até uma publicação explícita pela `main` protegida ou por versão.

## Ordem interna

1. política de remoção/retirada e pgTAP;
2. UI e smoke AAL2 da política;
3. clonagem profunda com snapshot independente;
4. editor de revisão draft e negações server-side;
5. gate consolidado, aplicação persistente, tipos, advisors, reconciliação e preview.

## Primeiro passo

Implementação local concluída para a primeira unidade:

- a migration `20260915085057_post02_registration_removal_policy.sql` decide entre `remove`, `withdraw` e `blocked` a partir do estado e das dependências reais;
- a mutação AAL2 recompõe a decisão sob locks de competição e inscrição, exige justificativa, é idempotente e audita sem excluir a equipe global;
- um trigger impede que a transição legada ou um `update` direto contorne a política;
- a tela da edição apresenta a operação como ação secundária, explica as consequências e exige confirmação explícita;
- o contrato TypeScript passou em compilação direta e os arquivos alterados passaram no Biome.

O ensaio pgTAP em rollback foi ampliado para 28 asserções. A repetição remota e o Vitest focal permanecem no gate antes do primeiro push porque o ambiente automático recusou temporariamente os subprocessos de teste; nenhuma migration POST-02 foi persistida.

## Clonagem profunda

A segunda unidade está implementada localmente:

- a migration `20260915091314_post02_ruleset_clone.sql` cria uma única revisão draft por edição, com proveniência e idempotência;
- a RPC AAL2 filtra origens ativas por série, categoria e, por padrão, naipe; outro naipe exige recompilação explicitamente confirmada;
- trilha, etapas, grupos, rodadas, entradas, vagas, confrontos e byes recebem identidades novas e referências internas recompostas;
- inscrições, atribuições de equipes, jogos, resultados e publicações não são clonados;
- a nova tela `/admin/competitions/:id/structure` explica a independência do snapshot, mostra o histórico e mantém revisões ativas somente leitura;
- 29 asserções pgTAP cobrem filtros, incompatibilidades, idempotência, isolamento de IDs, referências internas, outro naipe, auditoria e privilégios.

Biome e compilação TypeScript direta passaram. A migration continua somente local; o ensaio SQL descartável e o Vitest focal entram no gate consolidado antes do push.

## Próximo passo

Implementar o editor estrutural sobre a revisão draft clonada, com resumo de capacidade, origens tipadas/indefinidas, erros localizados e negações server-side. Depois executar o gate consolidado das três unidades.
