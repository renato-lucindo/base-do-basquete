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

## Próximo passo

Concluir o gate da unidade de remoção/retirada e então implementar a clonagem profunda e independente de template ou edição anterior.
