# POST-02 — Ciclo administrativo e editor completo

Estado: `DONE` na branch `feature/post-02-admin-cycle`; integração pendente da PR #43.

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

O ensaio SQL descartável passou 29/29 pgTAP em rollback após correção do tipo do ano e da constraint de auditoria. A migration continua somente local.

## Editor de revisão draft

- a migration `20260915120054_post02_draft_ruleset_editor.sql` adiciona revisão otimista (`editor_revision`), registro privado de idempotência e RPCs AAL2 de leitura/escrita;
- a leitura devolve trilha, etapas, rodadas, vagas, confrontos, origens e resumo normalizados, reconstruídos pelas FKs; não aceita grafo arbitrário do frontend;
- operações autorizadas no draft: renomear etapa/rodada, adicionar/remover confronto dentro da capacidade e redefinir a origem de cada lado como indefinida, vaga da revisão ou vencedor de rodada anterior;
- o banco rejeita alteração em revisão ativa ou em draft de edição publicada, origem inválida, remoção com dependências, excesso de capacidade, versão concorrente e idempotência divergente; cada sucesso gera auditoria mínima;
- a tela `/admin/competitions/:id/structure` fornece formulários progressivos por etapa/rodada/confronto, com CSRF, retorno ao rascunho e erros localizados; a action constrói inputs por operação, nunca encaminha JSON bruto do formulário;
- o ensaio transacional das três migrations com o pgTAP do editor passou 36/36, sem persistir schema ou dados.

## Gate local e próximo passo

`npm.cmd run check` passou: Biome, tipagem e typegen, 42 arquivos/290 Vitest, runbooks, build cliente/servidor e varredura de 563 arquivos rastreados. Os testes SQL das unidades anteriores passaram 28/28 e 29/29 em transações descartáveis. Nenhuma migration POST-02 foi aplicada, nenhuma branch foi enviada e produção continua em `v1.1.0`.

PR draft [#43](https://github.com/renato-lucindo/base-do-basquete/pull/43) aberta. No head `3fb2be0`, gate, banco desde zero (927 asserções), preview e CodeQL passaram. O primeiro ciclo revelou regressões do trigger em escritas operacionais; o hardening final permite apenas participantes exatamente derivados das vagas e mantém mudanças estruturais ativas bloqueadas.

As três migrations foram aplicadas sequencialmente ao Supabase compartilhado. As suites persistentes passaram 28/28, 29/29 e 36/36. O contrato TypeScript gerado pelo conector confirmou as novas colunas/RPCs já registradas no arquivo local e `tsc -b` passou. Advisors: os novos ledgers privados sem policy são intencionais (RLS forçada e nenhum grant); as novas RPCs SECURITY DEFINER são endpoints AAL2 intencionais e testados; não apareceu vulnerabilidade de schema ou FK sem índice. Reconciliação: 5 edições, 9 jogos, 12 inscrições, 5 revisões, zero drafts/requests residuais, zero vagas órfãs, 1 admin e 1 TOTP verificado.

## QA AAL2 final

O responsável concluiu login e MFA no preview e a sessão exibiu `AAL2`. O smoke real confirmou:

- a edição privada 100 clonou sua revisão ativa para o rascunho independente 187, sem copiar inscrições, jogos, resultados ou publicação;
- o editor alterou o nome da etapa sob controle de versão e o restaurou ao valor original; `editor_revision` avançou de 1 para 3 e as duas escritas ficaram auditadas;
- a inscrição 15, que já possui histórico competitivo, exibiu somente a retirada com preservação de histórico e encerramento dos atletas ativos; nenhuma retirada ou remoção foi executada;
- a rota administrativa sem cookie respondeu `302 /admin/login` com cookie `HttpOnly`, `Secure`, `SameSite=Strict`, CSP, Permissions Policy e `X-Robots-Tag: noindex`;
- `/health` respondeu `200` com `preview/ok`.

A reconciliação posterior preservou 5 edições, 9 jogos e 12 inscrições. O banco passou a ter 6 revisões, exatamente 1 draft, 1 pedido de clone, 2 pedidos de edição, 1 auditoria de clone, 2 auditorias de edição, zero vagas órfãs e zero origens indefinidas. As migrations continuam registradas uma única vez. Os advisors não apontaram vulnerabilidade nova nem FK sem índice; os ledgers privados sem policy e os endpoints SECURITY DEFINER AAL2 permanecem intencionais.

O inventário genérico sinalizou quatro tabelas auxiliares no schema `private` com RLS desabilitada. A verificação explícita confirmou ausência de `USAGE` para `anon` e ausência de qualquer privilégio `SELECT/INSERT/UPDATE/DELETE` para `anon` e `authenticated`; portanto não há exposição atual. O hardening de defesa em profundidade fica rastreado para o POST-04 e não foi aplicado fora do escopo desta PR.

O gate local final passou após normalização mecânica dos finais de linha dos tipos gerados: 42 arquivos/290 Vitest, typegen, TypeScript, runbooks, build e varredura de 563 arquivos. O head remoto `e2174fa` permanece com gate, banco desde zero (927 asserções), preview e CodeQL verdes, e a PR está limpa para integração. Produção permanece em `v1.1.0`.
