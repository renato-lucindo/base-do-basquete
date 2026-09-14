# Plano operacional de tasks retomáveis — PR #35

> Versão consolidada preservada para compatibilidade e auditoria. A entrada operacional preferida é [`tasks-pr35/README.md`](tasks-pr35/README.md), com regras separadas e um arquivo por task. Não manter estado divergente entre as duas representações.

## 1. Finalidade

Este documento converte o plano mestre e as instruções de refatoração em unidades de execução pequenas, seriadas e retomáveis. Ele não altera decisões de produto: organiza a implementação para impedir mistura de features, migrations difíceis de reverter, regressões silenciosas e perda de contexto entre sessões.

Fontes normativas, em ordem de precedência:

1. instrução explícita mais recente do responsável;
2. `AGENTS.md` e `HANDOFF.md`;
3. `PLANO-MESTRE-PR-FONTES-DE-DADOS-E-JOGADORES.md`;
4. `INSTRUCOES-IMPLEMENTACAO-REFATORACAO-ADMIN-E-REGULAMENTO.md` e `PLANO-REFATORACAO-ADMIN-CAMPEONATOS-E-EQUIPES.md`, preservados como referências do planejamento aprovado;
5. este plano operacional, apenas para ordem, fronteiras e retomada.

Este documento não autoriza merge, produção, exclusão de dados, alteração destrutiva de serviços ou exposição de informações privadas.

As referências usadas nos cartões são:

- `M`: `docs/plan/PLANO-MESTRE-PR-FONTES-DE-DADOS-E-JOGADORES.md`, fonte normativa versionada no repositório;
- `I`: `C:\Users\12405304716\Documents\Codex\2026-08-25\re\INSTRUCOES-IMPLEMENTACAO-REFATORACAO-ADMIN-E-REGULAMENTO.md`, instruções anexadas que originaram o detalhamento técnico;
- `A`: `C:\Users\12405304716\Documents\Codex\2026-08-25\re\PLANO-REFATORACAO-ADMIN-CAMPEONATOS-E-EQUIPES.md`, plano administrativo anexado;
- `H`: `C:\Users\12405304716\Documents\Codex\2026-08-25\re\HANDOFF.md`, handoff do planejamento anexado.

Uma sessão futura pode executar os cartões apenas com `M`, este arquivo e o `HANDOFF.md` do repositório. Consultar `I`, `A` e `H` para detalhes e rastreabilidade; se qualquer um deles divergir de `M` ou do estado real, prevalecem as fontes anteriores na lista de precedência.

## 2. Baseline reconciliada

- PR alvo: `#35`, draft.
- Branch: `feature/admin-workflow-improvements`.
- Head documental na criação deste plano: `14be1bf`.
- Head funcional aprovado: `ccef3f1`.
- `ADM-REF-00`, `ADM-REF-01A` e `ADM-REF-01B` estão concluídas.
- Próxima task elegível: `ADM-REF-01C`.
- O arquivo não rastreado `public/__admin-preview.html` não pertence a estas tasks e deve continuar preservado.
- Merge e deploy de produção permanecem proibidos sem autorização específica.

Antes de iniciar qualquer task, reconciliar esses fatos com `git status`, `git log --oneline -10`, `HANDOFF.md` e a PR remota. O estado real prevalece sobre esta fotografia.

## 3. Regras que impedem mistura e perda de contexto

### 3.1. Um único writer

- Manter apenas uma task de implementação em `DOING`.
- Não executar duas tasks com escrita simultânea na mesma branch ou banco.
- Agentes auxiliares, quando explicitamente autorizados, podem fazer somente inspeção ou testes independentes; não podem editar arquivos sobrepostos.
- Não começar a próxima task para “aproveitar a sessão”. Primeiro concluir, testar, documentar e versionar a atual.

### 3.2. Escopo fechado

Cada task define:

- objetivo único;
- dependências obrigatórias;
- caminhos iniciais permitidos;
- itens expressamente fora do escopo;
- entregáveis verificáveis;
- gate proporcional;
- condição objetiva de conclusão.

Se for necessário tocar uma feature de outra task, interromper a implementação, registrar a dependência e ajustar o plano/handoff. Não incorporar a feature silenciosamente.

### 3.3. Migrations imutáveis após envio

- Cada alteração de schema recebe migration nova, com timestamp posterior.
- Uma migration enviada ao GitHub ou aplicada em qualquer ambiente é imutável.
- Correções usam migration corretiva; nunca reescrever o arquivo já conhecido por outro ambiente.
- Usar rollout `expandir → classificar/backfill → impor`.
- A etapa de imposição só começa com relatório de pendências zerado e evidência registrada.
- Preview não aplica migrations automaticamente ao banco compartilhado. Uma feature que depende de schema novo exige compatibilidade de rollout ou aplicação autorizada no ambiente; não confundir “CI desde zero verde” com “schema do preview atualizado”.

### 3.4. Privacidade e autoridade

- Nunca inferir naipe ou sexo.
- `sex` não entra em DTO público, busca genérica, URL, log, analytics, auditoria genérica ou rascunho.
- Frontend não é autoridade de elegibilidade, progressão, publicação, limites ou exclusão.
- Toda mutação administrativa aplicável preserva AAL2, CSRF, mesma origem, RLS, idempotência, auditoria e privilégio mínimo.
- Dados ausentes permanecem ausentes; não transformar em zero nem fabricar denominadores.

### 3.5. Estado de uma task

Estados permitidos:

- `DONE`: evidências e commit remoto conhecidos;
- `READY`: dependências concluídas;
- `BLOCKED`: dependência objetiva ausente;
- `DOING`: única task com escrita atual;
- `REVIEW`: implementação pronta, aguardando somente gate remoto/QA;
- `CONDITIONAL`: só pode iniciar após uma medição ou fila zerada.

## 4. Protocolo de início e encerramento

### Início obrigatório

1. Ler `AGENTS.md`, `HANDOFF.md`, este documento e a seção normativa citada no cartão da task.
2. Executar `git status --short --branch` e `git log --oneline -10`.
3. Confirmar PR, branch, head e checks remotos.
4. Confirmar que as dependências estão `DONE`.
5. Mudar apenas a task escolhida para `DOING` no handoff; não editar cartões de tasks futuras sem necessidade.
6. Registrar a allowlist inicial de arquivos. Expansão exige motivo no handoff.

### Encerramento obrigatório

1. Terminar a menor unidade segura e executar o gate indicado.
2. Executar `git diff --check` e `git status --short`.
3. Atualizar `HANDOFF.md` com fatos reais, inclusive arquivos não rastreados.
4. Registrar commit, migrations, contagens, checks, preview, riscos e próximo cartão.
5. Fazer staging por caminhos exatos; nunca usar `git add .`, `-A` ou `--all`.
6. Manter a PR draft; não fazer merge nem produção.

### Bloco de handoff mínimo

```text
Task atual e estado:
Branch / head / PR:
Objetivo concluído:
Arquivos e migrations alterados:
Decisões e invariantes:
Testes locais reais:
CI / banco / preview / CodeQL:
Estado de filas e reconciliação:
Mudanças não commitadas e arquivos preservados:
Riscos ou bloqueios:
Próxima task: ID + primeiro arquivo + validação esperada
```

## 5. Gates proporcionais

| Gate       | Quando usar          | Mínimo obrigatório                                                           |
| ---------- | -------------------- | ---------------------------------------------------------------------------- |
| `G-DOC`    | documentação         | links/IDs conferidos, `git diff --check`, status e handoff                   |
| `G-DOMAIN` | domínio/contratos    | Biome nos caminhos, testes afetados, typecheck, build                        |
| `G-DB`     | schema/RPC/RLS       | migration nova, pgTAP positivo/negativo, tipos, CI desde zero, reconciliação |
| `G-UI`     | rota/componente      | `G-DOMAIN`, testes de componente, preview, 390/768/desktop e teclado         |
| `G-FLOW`   | fluxo vertical       | `G-DB` + `G-UI`, smoke autenticado AAL2, idempotência e auditoria            |
| `G-FULL`   | checkpoint de pacote | `npm run check`, banco desde zero, preview/smoke, CodeQL e handoff           |

O gate completo não substitui asserções específicas. Uma task de banco só termina quando os testes provam RLS, concorrência e negações relevantes.

## 6. Mapa de dependências

```text
Concluído: 00 → 01A → 01B

Fila principal:
01C → 01D → 01E → 01F → 01G
02A → 02B → 02C → 02D
03A → 03B → 03C → 03D → 03E
04A → 04B → 04C → 04D → 04E
05A → 05B
06A → 06B → 06C → 06D
07A → 07B → 07C → 07D → 07E → 06E → 06F
07F → 07G → 07H → 07I → 07J → 07K
08A → 08B → 08C → 08D
09A → 09B → 09C

Portões condicionais antes do fechamento:
01G → 01H → 09A
02D → 02E → 09A
```

Essa é também a fila padrão de execução: escolher sempre o primeiro cartão não concluído. `01H` e `02E` são condicionais; se a condição ainda não existir, registrar o adiamento no handoff e seguir pelo ramo principal. Ambas precisam estar `DONE` antes de `09A`. Só é permitido pular outro cartão por bloqueio objetivo documentado.

## 7. Cards executáveis

### ADM-REF-00 — Reconciliação e documentação

- **Estado:** `DONE`
- **Resultado:** PR #35 reconciliada, plano mestre importado, baseline e arquivo não rastreado preservados.
- **Ler:** `M` §§1, 15, 16 e 20; `I` §§1–4, 19 e 23; `H` integral.
- **Não refazer:** só reabrir se PR, branch ou fonte da verdade divergirem.

### ADM-REF-01A — Compatibilidade de naipe, sexo e perfil

- **Estado:** `DONE`
- **Resultado:** schema compatível, filas, RPCs AAL2, RLS e pgTAP.
- **Ler:** `M` §§5 e 11; `I` §§10, 11.1, 17 e 18.1.
- **Evidência:** head funcional anterior `6192cde`; CI desde zero verde.

### ADM-REF-01B — Contextos e rotas públicas por naipe

- **Estado:** `DONE`
- **Resultado:** perfil versionado no contexto, URLs canônicas, seletor legado sem inferência, conquistas contextualizadas e fallback de rollout.
- **Ler:** `M` §§5.1–5.6, 9.1 e 11; `I` §11.1.
- **Evidência:** `ccef3f1`; 77 Vitest e 268 pgTAP.

### ADM-REF-01C — Revisão administrativa de naipe e perfil

- **Estado:** `READY`
- **Objetivo:** permitir que admin AAL2 classifique uma edição pendente e vincule/crie/ative o perfil compatível.
- **Ler:** `M` §§5, 11 e 12; `I` §§11–13 e 17; `A` §5.
- **Caminhos iniciais:** rota do hub/edição, módulo server de competições, componentes de formulário, testes da rota.
- **Entregar:** loader privado de pendências; action por intents pequenas; seleção sem sugestão inferida; prévia de impacto; consumo exclusivo das RPCs aprovadas; estados vazio/erro/sucesso.
- **Não incluir:** formulário de sexo, elegibilidade de elenco, criação completa de edição ou enforcement final.
- **Gate:** `G-FLOW`.
- **Concluída quando:** uma edição pendente é revisada em AAL2, combinação incompatível é recusada e nenhuma informação privada entra na resposta.

### ADM-REF-01D — Formulário privado de sexo do atleta

- **Estado:** `BLOCKED` por `01C`
- **Objetivo:** coletar/alterar sexo somente no formulário administrativo específico.
- **Ler:** `M` §5.5; `I` §§11.1, 17 e 18.
- **Entregar:** criação global e inline sem valor padrão; edição AAL2 com justificativa e impacto; campo fora de rascunhos; auditoria sem valores; tipos privados isolados.
- **Não incluir:** busca genérica, lista pública, regra de associação ou parser PDF.
- **Gate:** `G-FLOW`, incluindo AAL1/usuário comum negados e varredura de HTML/DTO/log.
- **Concluída quando:** valor só aparece no formulário protegido e não vaza para contratos gerais.

### ADM-REF-01E — Elegibilidade em elenco e transferência

- **Estado:** `BLOCKED` por `01D`
- **Objetivo:** validar sexo/naipe na mesma transação de nova associação esportiva.
- **Ler:** `M` §§5.5 e 11; `I` §§9, 17 e 18.
- **Entregar:** RPC/serviço autoritativo; códigos estáveis para pendente/incompatível; UI recebe apenas decisão; histórico existente preservado; criação inline usa o mesmo contrato.
- **Não incluir:** importação PDF, backfill histórico ou remoção de inscrição.
- **Gate:** `G-DB` + testes de domínio e rota.
- **Concluída quando:** associação compatível passa, incompatível/nula falha e repetição não duplica dados.

### ADM-REF-01F — Elegibilidade na confirmação de importação

- **Estado:** `BLOCKED` por `01E`
- **Objetivo:** impedir que confirmação de importação associe atleta incompatível ou pendente.
- **Ler:** `M` §§5.5, 7.2 e 11; `I` §§11.7, 17 e 18.
- **Entregar:** integração da regra na transação existente; retorno de pendências por atleta sem sexo exposto; parser continua sem inferência; import permanece em review na falha.
- **Não incluir:** novo modelo de submissões, fallback ou suplemento.
- **Gate:** `G-FLOW` com os dois PDFs fixture.
- **Concluída quando:** import não contorna elegibilidade e não deixa escrita parcial.

### ADM-REF-01G — Classificação/backfill administrativo

- **Estado:** `BLOCKED` por `01F`
- **Objetivo:** persistir escolhas explícitas e produzir relatório de reconciliação sem alterar o histórico.
- **Ler:** `M` §§11.1, 11.2, 11.5 e 15; `I` §10.
- **Entregar:** migration nova de classificação; filas por edição/atleta; snapshots por edição quando perfis divergirem; contagens antes/depois; nenhuma escolha automática de sexo ou naipe.
- **Não incluir:** `NOT NULL`, remoção de fallback, reinterpretação de edições mistas/vazias.
- **Gate:** `G-DB`.
- **Concluída quando:** relatório explica todas as diferenças e identifica com precisão o que ainda impede enforcement.

### ADM-REF-01H — Enforcement final de naipe/perfil

- **Estado:** `CONDITIONAL`
- **Entrada obrigatória:** filas de naipe/perfil zeradas no ambiente alvo e autorização para aplicar a etapa de imposição.
- **Objetivo:** tornar obrigatórias as invariantes finais sem interromper histórico.
- **Ler:** `M` §§5, 11 e 19; `I` §§10, 17 e 22.
- **Entregar:** migration corretiva/final nova; `NOT NULL`/FK/unicidade finais; novas escritas sem resolver legado; relatório pós-migration.
- **Não incluir:** apagar atletas com sexo nulo, alterar URLs históricas à força ou remover colunas legadas ainda consumidas.
- **Gate:** `G-DB` + base representativa.
- **Concluída quando:** nenhuma linha inválida existe e aplicações antiga/nova obedecem ao plano de rollout acordado.

### ADM-REF-02A — Tabela de submissões versionadas

- **Estado:** `BLOCKED` por `01G` e pelo registro da execução ou do adiamento de `01H`
- **Objetivo:** separar a identidade do jogo das entradas manual/boxscore.
- **Ler:** `M` §§6.1, 6.2 e 11; `I` §§6, 10 e 11.
- **Entregar:** `game_data_submissions`, estados, papéis, hash/idempotência, RLS/grants/índices e tipos.
- **Não incluir:** autoridade por domínio, UI, backfill ou mudança nos fluxos atuais.
- **Gate:** `G-DB`.
- **Concluída quando:** duas fontes podem existir no mesmo `game_id` sem duas submissões ativas duplicadas da mesma versão.

### ADM-REF-02B — Autoridade por domínio e estado derivado

- **Estado:** `BLOCKED` por `02A`
- **Objetivo:** garantir uma autoridade ativa compatível por jogo/domínio.
- **Ler:** `M` §§6.3, 8 e 10; `I` §§8, 9 e 11.2.
- **Entregar:** `game_data_domain_authority`, matriz de capacidades, RPCs de ativação, view derivada `game_data_status`, cobertura e testes concorrentes.
- **Não incluir:** comparação visual, adaptação de súmula/boxscore ou progressão.
- **Gate:** `G-DB`.
- **Concluída quando:** fonte incapaz é recusada, concorrência tem um vencedor e o estado não diverge das submissões.

### ADM-REF-02C — Backfill de submissões e autoridades

- **Estado:** `BLOCKED` por `02B`
- **Objetivo:** encapsular jogos atuais sem mudar fatos esportivos.
- **Ler:** `M` §§11.3–11.5; `I` §10.
- **Entregar:** migration nova de backfill para manual/boxscore/seed; relatório de hashes, placares, pontos, faltas e cobertura; `legacy_seed` somente histórico.
- **Não incluir:** classificar fase por número do jogo ou impor confronto obrigatório.
- **Gate:** `G-DB` com checksums antes/depois.
- **Concluída quando:** IDs e resultados permanecem iguais e cada domínio ativo tem origem explicável.

### ADM-REF-02D — Invólucro estrutural legado e vínculo opcional

- **Estado:** `BLOCKED` por `02C`
- **Objetivo:** criar a fundação mínima para vincular jogos a confrontos sem inventar fases históricas.
- **Ler:** `M` §§11 e 13; `I` §§5, 6 e 10; `A` §9.7.
- **Entregar:** estrutura mínima versionada, `legacy_unclassified`, `games.matchup_id` anulável, integridade de competição e relatório de não classificados.
- **Não incluir:** editor, progressão, classificação automática ou `NOT NULL`.
- **Gate:** `G-DB`.
- **Concluída quando:** todo jogo é preservado e os casos não comprováveis ficam explicitamente não classificados.

### ADM-REF-02E — Enforcement de novos jogos em confrontos

- **Estado:** `CONDITIONAL`
- **Entrada obrigatória:** fluxos de criação/importação adaptados e histórico encapsulado.
- **Objetivo:** bloquear novos jogos fora de confronto válido.
- **Ler:** `M` §§11 e 13; `I` §§5, 9 e 10.
- **Entregar:** migration nova, RPCs atualizadas, tipos e negações de escrita direta.
- **Não incluir:** editor, progressão ou reclassificação do histórico.
- **Gate:** `G-DB` + regressão de súmula/importação.
- **Concluída quando:** nenhum fluxo novo contorna o vínculo e o histórico continua legível.

### ADM-REF-03A — Comparador e contratos puros de ingestão

- **Estado:** `BLOCKED` por `02B` e `02D`
- **Objetivo:** comparar submissões e mapear capacidades sem banco/UI acoplados.
- **Ler:** `M` §§6.3 e 8.1; `I` §§8 e 11.2.
- **Entregar:** funções puras para participantes, placar, períodos, pontos, cestas, camisas como aviso e erros estáveis em português.
- **Não incluir:** mutações, upload ou componentes.
- **Gate:** `G-DOMAIN`.
- **Concluída quando:** fixtures iguais/divergentes cobrem normal, inversão permitida e conflito consumido.

### ADM-REF-03B — Súmula no jogo existente

- **Estado:** `BLOCKED` por `03A`
- **Objetivo:** confirmar súmula como submissão do jogo/confronto já existente.
- **Ler:** `M` §§7.1 e 8; `I` §§9 e 11.4.
- **Entregar:** seleção do jogo, RPC transacional, idempotência, autoridades compatíveis e preservação do fluxo compacto atual.
- **Não incluir:** fallback de edição boxscore ou boxscore suplementar.
- **Gate:** `G-FLOW`.
- **Concluída quando:** nenhuma confirmação cria segundo jogo e repetição devolve a submissão existente.

### ADM-REF-03C — Boxscore no jogo existente

- **Estado:** `BLOCKED` por `03B`
- **Objetivo:** confirmar PDF como submissão vinculada ao jogo/confronto.
- **Ler:** `M` §§7.2 e 8; `I` §§9, 11.5 e 11.7.
- **Entregar:** resolução do jogo, revisão, transação atômica, deduplicação e autoridades suportadas; PDFs continuam privados.
- **Não incluir:** promoção de fallback ou UI de conflito.
- **Gate:** `G-FLOW` com os dois PDFs.
- **Concluída quando:** import não cria jogo paralelo e falhas não deixam dados parciais.

### ADM-REF-03D — Fallback manual e suplemento boxscore

- **Estado:** `BLOCKED` por `03C`
- **Objetivo:** suportar as exceções por jogo sem alterar a fonte primária da edição.
- **Ler:** `M` §§7 e 8; `I` §§11.4, 11.5 e 11.7.
- **Entregar:** motivo obrigatório, papéis `fallback`/`supplemental`, `awaiting_primary_source`, comparação e promoção/supersessão sem apagar histórico.
- **Não incluir:** escolha manual de autoridade incompatível ou redesign das páginas públicas.
- **Gate:** `G-FLOW`.
- **Concluída quando:** normal, fallback definitivo, PDF posterior igual e divergente têm estados determinísticos.

### ADM-REF-03E — Revisão administrativa de conflitos

- **Estado:** `BLOCKED` por `03D`
- **Objetivo:** permitir decisão explícita por domínio compatível.
- **Ler:** `M` §§8 e 12.3; `I` §§11, 17 e 18.
- **Entregar:** tela em resumo/diferenças/autoridade; impacto antes de confirmar; AAL2; auditoria; erros localizados.
- **Não incluir:** publicação ou progressão automática.
- **Gate:** `G-UI` + concorrência/idempotência no backend.
- **Concluída quando:** não é possível selecionar uma fonte incapaz e nada muda sem confirmação.

### ADM-REF-04A — Read model de jogadores de súmula

- **Estado:** `BLOCKED` por `03E`
- **Objetivo:** produzir apenas métricas confiáveis de edição manual.
- **Ler:** `M` §§9.3 e 10; `I` §§11.3 e 11.6.
- **Entregar:** views `security_invoker` de edição/jogo, participação sem DNP, PTS, PTS/J, 2PC, 3PC, LLC, faltas e desqualificações, cobertura e índices medidos.
- **Não incluir:** percentuais, tentativas ou componente visual.
- **Gate:** `G-DB`.
- **Concluída quando:** ausência continua nula e fontes não são somadas no mesmo domínio.

### ADM-REF-04B — DTO discriminado e loader scoresheet

- **Estado:** `BLOCKED` por `04A`
- **Objetivo:** resolver `scoresheet`/`boxscore` pelo perfil vinculado.
- **Ler:** `M` §§9.1 e 10; `I` §§11.1 e 11.6.
- **Entregar:** DTO sem campos opcionais ambíguos, loader server-side, busca/filtro/ordenação e testes de isolamento por naipe.
- **Não incluir:** componente final ou alteração visual do boxscore.
- **Gate:** `G-DOMAIN`.
- **Concluída quando:** nenhuma decisão usa `categories.has_advanced_stats` ou contagem de jogos.

### ADM-REF-04C — Listagem pública scoresheet

- **Estado:** `BLOCKED` por `04B`
- **Objetivo:** implementar a nova página simples de jogadores.
- **Ler:** `M` §9.3; `I` §§11.6, 18.3 e 18.4.
- **Entregar:** tabela/linhas móveis, busca, equipe, ordenação, URL restaurável, GD condicional, vazio/erro/carregamento e acessibilidade.
- **Não incluir:** comparador, filtros avançados ou perfil detalhado.
- **Gate:** `G-UI`.
- **Concluída quando:** 390/768/desktop, teclado e overflow passam com dados controlados.

### ADM-REF-04D — Perfil contextual scoresheet

- **Estado:** `BLOCKED` por `04C`
- **Objetivo:** exibir histórico confiável do atleta na edição manual.
- **Ler:** `M` §9.4; `I` §11.6.
- **Entregar:** equipe/camisa, jogos, pontos, média, cestas, faltas, GD, DNP e links por jogo; bloco global respeita cobertura por temporada.
- **Não incluir:** métricas avançadas agregadas entre capacidades diferentes.
- **Gate:** `G-UI`.
- **Concluída quando:** perfil e listagem reconciliam os mesmos totais.

### ADM-REF-04E — Projeção compatível do boxscore raro

- **Estado:** `BLOCKED` por `04D`
- **Objetivo:** incluir boxscore suplementar somente no subconjunto compatível da edição manual.
- **Ler:** `M` §§9.5 e 10; `I` §§11.3 e 11.6.
- **Entregar:** projeção J/PTS/PTS-J/2PC/3PC/LLC/F/GD e cobertura; avançados restritos ao jogo.
- **Não incluir:** métricas avançadas no agregado manual ou redesign da página.
- **Gate:** `G-DB` + regressão pública.
- **Concluída quando:** ranking permanece comparável e nenhum dado avançado vaza para a tabela manual.

### ADM-REF-05A — Read model boxscore orientado por autoridade

- **Estado:** `BLOCKED` por `04E`
- **Objetivo:** trocar internamente a fonte dos dados avançados sem mudar o contrato visual normal.
- **Ler:** `M` §§9.2 e 10; `I` §§11.3, 11.5 e 11.6.
- **Entregar:** `gamesPlayed` versus `advancedGamesPlayed`, pontos oficiais versus avançados, denominadores reais e aviso somente para cobertura incompleta.
- **Não incluir:** redesign, nova nomenclatura ou remoção de controles.
- **Gate:** `G-DB` + `G-DOMAIN`.
- **Concluída quando:** fallback manual conta nos básicos e não contamina médias/eficiência avançadas.

### ADM-REF-05B — Regressão visual da página boxscore

- **Estado:** `BLOCKED` por `05A`
- **Objetivo:** provar equivalência com cobertura de boxscore completa.
- **Ler:** `M` §9.2; `I` §18.
- **Entregar:** testes/snapshots úteis, QA de busca, modos, presets, filtros, comparação, ordenação, paginação, URL e responsividade.
- **Não incluir:** novas features visuais.
- **Gate:** `G-UI` + comparação com baseline aprovada.
- **Concluída quando:** cenário 100% boxscore não apresenta regressão observável.

### ADM-REF-06A — Navegação administrativa por áreas

- **Estado:** `BLOCKED` por `05B`
- **Objetivo:** separar Competições, Equipes, Atletas e Segurança.
- **Ler:** `M` §§12 e 13; `I` §13; `A` §§4 e 5.
- **Entregar:** rotas/shell, estados em português, cartões compactos e hub funcional por subrota.
- **Não incluir:** accordion, criação de edição, editor esportivo ou publicação.
- **Gate:** `G-UI`.
- **Concluída quando:** nenhuma rota vira action monolítica e os fluxos existentes continuam acessíveis.

### ADM-REF-06B — Accordion acessível de equipes

- **Estado:** `BLOCKED` por `06A`
- **Objetivo:** reduzir a informação simultânea no hub.
- **Ler:** `M` §13; `I` §14; `A` §6.
- **Entregar:** todas recolhidas, abertura única, seções Elenco/Situação/Resultado, retorno por URL, teclado/ARIA e 390 px.
- **Não incluir:** mudança das regras de remoção/retirada.
- **Gate:** `G-UI`.
- **Concluída quando:** nenhuma lista extensa aparece sem ação e os fluxos atuais salvam sem regressão.

### ADM-REF-06C — Política transacional de remoção/retirada

- **Estado:** `BLOCKED` por `06B`
- **Objetivo:** banco decide entre remover inscrição provisória, retirar ou bloquear.
- **Ler:** `M` §13; `I` §§9, 13 e 17; `A` §7.
- **Entregar:** RPC AAL2, verificação/mutação na mesma transação, dependências, idempotência, auditoria e códigos estáveis.
- **Não incluir:** exclusão do cadastro global da equipe ou UI.
- **Gate:** `G-DB`.
- **Concluída quando:** histórico competitivo nunca é apagado e repetição é segura.

### ADM-REF-06D — UI de remoção/retirada

- **Estado:** `BLOCKED` por `06B` e `06C`
- **Objetivo:** expor a política com confirmação e consequências claras.
- **Ler:** `M` §13; `I` §§13, 17 e 18; `A` §§7 e 15.
- **Entregar:** ação secundária, modal/texto adequado a cada decisão do servidor, foco/erros e retorno ao accordion.
- **Não incluir:** alterar a política transacional ou excluir o cadastro global da equipe.
- **Gate:** `G-FLOW`.
- **Concluída quando:** usuário não consegue confundir remoção da inscrição com exclusão da equipe.

### ADM-REF-07A — Templates e revisões imutáveis

- **Estado:** `BLOCKED` por `06D`
- **Objetivo:** criar fundação versionada do regulamento sem editar revisão ativa.
- **Ler:** `M` §13; `I` §§6.1, 6.2 e 10; `A` §§8.6 e 9.8.
- **Entregar:** templates, revisions, estados, origem/ponto de corte, unicidade ativa, RLS e auditoria.
- **Não incluir:** grafo, UI ou progressão.
- **Gate:** `G-DB`.
- **Concluída quando:** revisão ativa é imutável e apenas uma comanda a edição.

### ADM-REF-07B — Trilhas, etapas, grupos e rodadas

- **Estado:** `BLOCKED` por `07A`
- **Objetivo:** normalizar a hierarquia estrutural até a rodada.
- **Ler:** `M` §13; `I` §§5, 6.3 e 10; `A` §9.7.
- **Entregar:** tabelas/FKs/ordem/funções estruturais; contratos locais; índices; RLS.
- **Não incluir:** vagas, confrontos, partidas ou editor.
- **Gate:** `G-DB`.
- **Concluída quando:** função eliminatória é tipada e não deriva do nome.

### ADM-REF-07C — Vagas, confrontos e contrato de partidas

- **Estado:** `BLOCKED` por `07B`
- **Objetivo:** modelar origens tipadas, dois lados, bye, jogo único/ida-volta/melhor de N e vínculo do jogo.
- **Ler:** `M` §13; `I` §§6.4, 6.5 e 10; `A` §§9.7 e 9.7.1.
- **Entregar:** constraints/FKs/índices, detecção de ciclo e capacidade local, participantes concretos preservados.
- **Não incluir:** progressão ou criação livre pelo frontend.
- **Gate:** `G-DB`.
- **Concluída quando:** origem inválida/futura/cíclica e partida excedente são recusadas.

### ADM-REF-07D — Compilar, validar e ativar regulamento

- **Estado:** `BLOCKED` por `07C`
- **Objetivo:** tornar o banco autoridade dos contratos esportivos.
- **Ler:** `M` §13; `I` §§5–9; `A` §8.6.
- **Entregar:** domínio puro, RPCs transacionais, bloqueio de rodada, limites de oitavas/quartas/semifinal/final, idempotência e ativação atômica.
- **Não incluir:** editor completo ou progressão de resultados.
- **Gate:** `G-DB` + testes de domínio/concorrência.
- **Concluída quando:** terceiro confronto de semifinal falha mesmo sob concorrência.

### ADM-REF-07E — Clonagem de template/edição anterior

- **Estado:** `BLOCKED` por `07D`
- **Objetivo:** criar uma revisão independente a partir de origem reutilizável.
- **Ler:** `M` §13; `I` §12; `A` §§8.4 e 8.6.
- **Entregar:** clonagem profunda, filtro série/categoria/naipe, recompilação explícita para outro naipe e snapshot independente.
- **Não incluir:** criação da edição ou editor.
- **Gate:** `G-DB` + domínio.
- **Concluída quando:** mudanças futuras no template não alteram edição criada.

### ADM-REF-06E — Criação transacional de edição

- **Estado:** `BLOCKED` por `07E`
- **Objetivo:** criar edição privada com perfil e regulamento inicial coerentes.
- **Ler:** `M` §§5.3 e 13; `I` §12; `A` §8.
- **Entregar:** normalização, ano 1900–ano seguinte, novo ano dinâmico, unicidade por naipe, período, perfil obrigatório e clonagem escolhida em uma operação idempotente.
- **Não incluir:** wizard visual ou publicação.
- **Gate:** `G-DB` + domínio.
- **Concluída quando:** falha não deixa edição parcial e novo ano não exige tabela auxiliar.

### ADM-REF-06F — Wizard de criação de edição

- **Estado:** `BLOCKED` por `06E`
- **Objetivo:** implementar o fluxo guiado completo.
- **Ler:** `M` §§5.3 e 13; `I` §12; `A` §8.
- **Entregar:** identificação, fonte, período, formato, revisão, aviso de novo ano, foco no erro, guard de alterações e redirecionamento ao hub.
- **Não incluir:** editor do regulamento ou publicação.
- **Gate:** `G-FLOW` em 390/768/desktop.
- **Concluída quando:** edições masculina/feminina e histórica/futura nascem privadas e coerentes.

### ADM-REF-07F — Editor estrutural do regulamento

- **Estado:** `BLOCKED` por `06F` e `07D`
- **Objetivo:** editar somente revisão draft por cartões progressivos.
- **Ler:** `M` §13; `I` §15; `A` §§8.6 e 9.7.
- **Entregar:** trilhas/etapas/rodadas/vagas/confrontos, resumo de capacidade, origens indefinidas e erros localizados; sem botão além da capacidade.
- **Não incluir:** agendamento, progressão ou emenda.
- **Gate:** `G-UI` + negações server-side.
- **Concluída quando:** interface não permite violar contratos e tentativa direta também falha.

### ADM-REF-07G — Agendamento de partidas

- **Estado:** `BLOCKED` por `07F`
- **Objetivo:** criar/preparar partidas somente dentro de confronto válido.
- **Ler:** `M` §13; `I` §§6.5 e 15; `A` §9.7.
- **Entregar:** RPC e UI para rodada/confronto, ordem, data/hora/local/mando, participantes derivados e preparação privada com vagas pendentes.
- **Não incluir:** publicação ou placar fictício.
- **Gate:** `G-FLOW`.
- **Concluída quando:** jogo scheduled não aparece como 0×0 e não nasce fora do regulamento.

### ADM-REF-07H — Validação e progressão de confronto

- **Estado:** `BLOCKED` por `07G` e `03D`
- **Objetivo:** resolver confronto explicitamente pelo `official_result` ativo.
- **Ler:** `M` §§8.2 e 13; `I` §§7–9; `A` §9.7.1.
- **Entregar:** locks determinísticos, idempotência, resolução imutável, vagas dependentes, participantes privados e `ready_to_schedule`; sem publicar.
- **Não incluir:** publicação, edição de jogo concluído ou nova regra de autoridade de dados.
- **Gate:** `G-DB` + fluxo ponta a ponta.
- **Concluída quando:** vencedor/perdedor progride uma vez e draft/review nunca progride.

### ADM-REF-07I — Encerramento de classificatória/grupos

- **Estado:** `BLOCKED` por `07H`
- **Objetivo:** propagar posições somente após classificação validada.
- **Ler:** `M` §§8.2 e 13; `I` §§7–9; `A` §9.7.1.
- **Entregar:** RPC separada, snapshot da tabela, desempates/entradas fechados e resolução das vagas posteriores.
- **Não incluir:** usar tabela provisória, publicar jogos ou alterar regras de desempate na UI.
- **Gate:** `G-DB`.
- **Concluída quando:** tabela provisória não troca participantes futuros.

### ADM-REF-07J — W.O., desistência e decisão administrativa

- **Estado:** `BLOCKED` por `07H`
- **Objetivo:** resolver sem jogo ou placar fictício.
- **Ler:** `M` §§8.2 e 13; `I` §§6.6, 7 e 9; `A` §§9.7.1 e 9.9.
- **Entregar:** tipos, motivo, AAL2, auditoria, impacto e ação secundária na UI.
- **Não incluir:** fabricar partida/placar, apagar histórico ou antecipar emendas.
- **Gate:** `G-FLOW`.
- **Concluída quando:** resolução produz saídas esportivas válidas sem fabricar partida.

### ADM-REF-07K — Correções e emendas

- **Estado:** `BLOCKED` por `07I` e `07J`
- **Objetivo:** corrigir futuro sem reescrever passado consumido.
- **Ler:** `M` §§8.3 e 13; `I` §§6.2, 7 e 8; `A` §9.8.
- **Entregar:** correção antes de dependente iniciado; bloqueio posterior; clone de revisão, ponto de corte, antes/depois, ativação atômica e supersessão sem delete.
- **Não incluir:** editar revisão ativa, reescrever jogo iniciado/concluído ou excluir revisão anterior.
- **Gate:** `G-DB` + `G-UI`.
- **Concluída quando:** jogos iniciados/concluídos permanecem imutáveis e o futuro troca de versão atomicamente.

### ADM-REF-08A — Estados editoriais e RLS pública

- **Estado:** `BLOCKED` por `07K`
- **Objetivo:** separar definitivamente estado esportivo de visibilidade.
- **Ler:** `M` §13; `I` §§10, 16 e 17; `A` §9.
- **Entregar:** schema editorial versionado, RLS uniforme para edição/jogo/detalhe/busca/API e URLs privadas indisponíveis.
- **Não incluir:** resumo/UI de publicação.
- **Gate:** `G-DB`.
- **Concluída quando:** final pode ser privado e scheduled pode ser público somente quando autorizado.

### ADM-REF-08B — Resumo e regras temporais de publicação

- **Estado:** `BLOCKED` por `08A`
- **Objetivo:** calcular mudanças e bloquear publicação antes de `starts_on`.
- **Ler:** `M` §13; `I` §16; `A` §§9.2, 9.3 e 9.6.
- **Entregar:** resumo server-side, avisos/bloqueios, `America/Sao_Paulo`, idempotência e nenhuma rotina automática.
- **Não incluir:** UI final, publicação agendada ou mudança do estado esportivo.
- **Gate:** `G-DB` + domínio temporal.
- **Concluída quando:** chegar a data apenas habilita a ação e não publica conteúdo.

### ADM-REF-08C — Revisão e publicação administrativa

- **Estado:** `BLOCKED` por `08B`
- **Objetivo:** apresentar impacto e executar publicação AAL2 explícita.
- **Ler:** `M` §13; `I` §§16–18; `A` §9.
- **Entregar:** tela enxuta, confirmação, alterações pendentes, republicação versionada, foco e estados completos.
- **Não incluir:** progressão esportiva, publicação automática ou redesign público.
- **Gate:** `G-FLOW`.
- **Concluída quando:** público lê a última versão validada até nova confirmação.

### ADM-REF-08D — Área pública por estrutura esportiva

- **Estado:** `BLOCKED` por `08C`
- **Objetivo:** agrupar jogos por trilha/etapa/rodada e aplicar a mesma visibilidade em todas as superfícies.
- **Ler:** `M` §13; `I` §16; `A` §§9.6 e 9.7.
- **Entregar:** read models/loaders/componentes, mensagem pré-início, busca/canonical/cache coerentes e URLs diretas protegidas.
- **Não incluir:** editor administrativo, inferência por número do jogo ou exposição de conteúdo privado.
- **Gate:** `G-UI` + smokes público/privado.
- **Concluída quando:** nenhuma superfície expõe jogo privado e a fase deriva do confronto.

### ADM-REF-09A — Reconciliação e enforcement global

- **Estado:** `BLOCKED` por `01H`, `02E`, `05B`, `06D` e `08D`
- **Objetivo:** provar migrations desde zero e sobre base representativa.
- **Ler:** `M` §§11.5, 15, 17 e 18; `I` §§18–21.
- **Entregar:** contagens/checksums, relatório de pendências, advisors, tipos regenerados e migrations corretivas finais.
- **Não incluir:** feature nova, refatoração oportunista ou exclusão para zerar pendência.
- **Gate:** `G-FULL` + banco representativo.
- **Concluída quando:** toda diferença é explicada e nenhuma fila obrigatória permanece.

### ADM-REF-09B — QA integral autenticado e público

- **Estado:** `BLOCKED` por `09A`
- **Objetivo:** validar os fluxos de produto, segurança e acessibilidade no preview real.
- **Ler:** `M` §§17 e 18; `I` §§18, 20 e 21; `A` §§11 e 15.
- **Entregar:** AAL2, anon/AAL1, 390/768/desktop, teclado, zoom 200%, duas edições por naipe, criação, equipes, ingestão, jogadores, progressão, publicação e ausência de sexo no tráfego público.
- **Não incluir:** ampliar escopo; defeitos encontrados voltam ao menor cartão produtor do contrato.
- **Gate:** `G-FULL`.
- **Concluída quando:** evidências e defeitos resolvidos estão associados ao head exato.

### ADM-REF-09C — Fechamento documental da PR draft

- **Estado:** `BLOCKED` por `09B`
- **Objetivo:** tornar a entrega revisável sem executar merge/produção.
- **Ler:** `M` §§15, 16 e 18; `I` §§20 e 23.
- **Entregar:** `HANDOFF.md`, relatório de migration/reconciliação, evidências, checklist/descrição da PR autorizados, status e próximo passo humano.
- **Não incluir:** merge, deploy de produção ou nova implementação funcional.
- **Gate:** `G-DOC` e reconfirmação dos checks do head.
- **Concluída quando:** outro agente ou revisor consegue reproduzir estado, riscos e validações somente pelo repositório/PR.

## 8. Prompt para iniciar uma task separada

Copiar o bloco abaixo, substituindo apenas o ID:

```text
Execute exclusivamente a task <ID> de docs/plan/PLANO-TASKS-RETOMAVEIS-PR35.md.

Antes de editar, leia AGENTS.md, HANDOFF.md, o protocolo global do plano de tasks e as seções normativas citadas no cartão. Reconcilie git status, os dez últimos commits, a PR #35 e os checks remotos. Preserve todo trabalho existente e public/__admin-preview.html.

Não implemente nenhuma feature pertencente a outro cartão. Se surgir dependência nova, registre-a no HANDOFF.md e pare na menor unidade segura. Use migration nova; não altere migration já enviada/aplicada. Faça staging somente por caminhos exatos. Execute o gate indicado, atualize o HANDOFF.md e deixe o próximo ID, primeiro arquivo e validação esperada. Mantenha a PR draft; não faça merge nem produção.
```

## 9. Regra de manutenção deste plano

- Atualizar estado e dependências somente com evidência real.
- Não reescrever cartões `DONE`; adicionar nota corretiva e referência ao commit.
- Se uma task crescer além de uma migration ou de uma superfície vertical verificável, dividi-la antes de editar código.
- Se duas tasks precisarem alterar o mesmo contrato, executar primeiro a task produtora do contrato e fazer a consumidora depender do commit aprovado.
- Alterações de produto voltam ao plano mestre antes de serem refletidas aqui.
