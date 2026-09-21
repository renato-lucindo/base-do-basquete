# Plano mestre da PR — administração, fontes dos jogos e páginas de jogadores

**Projeto:** Base do Basquete
**Data:** 27/08/2026
**Status:** pronto para revisão do responsável pelo produto
**Entrega:** implementação diretamente na PR draft, sem protótipo HTML intermediário
**PR de continuidade identificada:** `renato-lucindo/base-do-basquete#35`
**Branch identificada:** `feature/admin-workflow-improvements`

## 1. Objetivo e regra de precedência

Este documento consolida o plano anterior e fecha as lacunas relacionadas a:

- criação e edição de campeonatos;
- regulamento, confrontos e progressão automática;
- organização integral do painel administrativo;
- escolha da fonte primária dos dados dos jogos;
- diferenciação das edições por naipe e elegibilidade privada dos atletas;
- convivência segura entre súmula manual e boxscore;
- nova experiência pública de jogadores para campeonatos baseados em súmula;
- preservação integral da página atual de jogadores baseada em boxscore;
- continuidade do trabalho entre sessões por meio do `HANDOFF.md`.

Em caso de conflito, a ordem é:

1. nova instrução explícita do responsável pelo produto;
2. este plano mestre;
3. `INSTRUCOES-IMPLEMENTACAO-REFATORACAO-ADMIN-E-REGULAMENTO.md`;
4. `PLANO-REFATORACAO-ADMIN-CAMPEONATOS-E-EQUIPES.md`;
5. documentos anteriores.

O protótipo HTML foi retirado do fluxo. A validação visual ocorrerá diretamente no preview da PR draft.

## 2. Decisões de produto fechadas

1. A fonte primária não pertence à raiz genérica do campeonato.
2. A fonte primária é definida pela combinação exata **série + categoria + naipe**.
3. A edição anual é identificada por **série + categoria + naipe + ano** e mantém vínculo imutável com a versão da configuração que recebeu ao ser criada ou validada.
4. As opções iniciais são `Súmula manual` e `Boxscore PDF`; o segundo aceita somente contratos de formato explicitamente versionados.
5. Não haverá opção livre, automática ou “mista” como fonte primária.
6. A fonte primária define o fluxo esperado, as capacidades públicas e o desenho da página de jogadores; ela não proíbe exceções por jogo.
7. Campeonatos cuja fonte primária é súmula usarão uma nova página de jogadores, desenhada somente com dados realmente disponíveis na súmula.
8. A página atual de jogadores para boxscore será preservada em estrutura visual, controles, métricas e comportamento no cenário normal.
9. Em uma edição de súmula, um boxscore raro poderá enriquecer o detalhe daquele jogo, mas não transformará a página da edição em uma página avançada.
10. Em uma edição de boxscore, uma súmula manual de emergência será permitida, exigirá motivo e ficará marcada como substituição temporária aguardando o PDF.
11. A chegada posterior do PDF nunca apagará a súmula de emergência e nunca sobrescreverá dados silenciosamente.
12. Resultado, publicação, progressão esportiva e fonte estatística são estados independentes.
13. Jogos e alterações só chegam ao público após validação administrativa explícita e resumo curto calculado pelo servidor.
14. Jogos de competição futura podem ser preparados antes do início, mas só podem ser publicados a partir de `starts_on`; a data não publica nada automaticamente.
15. O confronto seguinte é preparado automaticamente somente depois da validação definitiva do confronto anterior.
16. Equipes começam recolhidas em accordion vertical e apenas uma fica aberta por vez.
17. A equipe global não é apagada por remover sua participação em uma edição; a inscrição é removida ou retirada conforme o histórico.
18. O trabalho continuará na PR draft #35 enquanto ela permanecer aberta e compatível. Não será criada PR duplicada.
19. Merge e produção continuam fora do escopo até autorização explícita.
20. O naipe é uma dimensão pública e obrigatória, inicialmente `Masculino` ou `Feminino`.
21. O sexo do atleta é um dado administrativo privado, usado para validar elegibilidade no naipe e nunca publicado.
22. O sexo não aparece em páginas, busca, APIs públicas, URLs, logs operacionais, auditorias, analytics ou rascunhos do navegador.
23. Novos atletas exigem sexo informado; atletas históricos sem o dado entram em fila administrativa de revisão sem desaparecer do histórico público.

## 3. Contexto confirmado nos dois repositórios

### 3.1. Base do Basquete atual

O projeto atual já possui peças importantes que devem ser preservadas:

- `competitions` representa hoje uma edição pela combinação série, categoria e ano e precisará incorporar o naipe para evitar colisões;
- `competition_series` e `categories` já existem como dimensões separadas;
- súmula manual e boxscore alimentam `games`, `game_participants`, `game_roster_slots`, `player_period_stats` e `foul_events`;
- `competition_player_statistics` agrega participação, pontuação, arremessos e faltas;
- o frontend já possui DTOs `simple` e `advanced` e componentes separados de tabela;
- a página avançada atual tem busca, ordenação, presets, filtros, comparação, paginação e estado restaurável na URL;
- a página simples atual mostra somente atleta, equipe, jogos, pontos por jogo e pontos;
- AAL2, RLS, CSRF, idempotência, auditoria e PDF privado já fazem parte do contrato.

Também existem quatro limitações que precisam ser corrigidas:

1. `categories.has_advanced_stats` decide a capacidade apenas pela categoria. Isso falha no exemplo Adulto/Ouro versus Adulto/Prata/Bronze e em Sub-22 versus outras categorias da mesma série.
2. `games.source` aceita um único valor `manual`, `boxscore` ou `seed`, confundindo identidade do jogo com a submissão de dados.
3. Súmula e boxscore criam o jogo completo em fluxos separados; a restrição `(competition_id, game_number)` faz o segundo fluxo colidir em vez de complementar o jogo existente.
4. Na súmula, tentativas são hoje persistidas iguais às cestas convertidas. Se esses campos forem expostos como avançados, o sistema produz percentuais artificiais de 100%.

### 3.2. O que pode ser aproveitado do `site-bask`

Foram consultados pelo plugin GitHub, em modo somente leitura:

- `src/lib/competition-context.ts`;
- `src/routes/campeonatos.$year.$comp.$category.$resource.tsx`;
- `src/routes/campeonatos.$year.$comp.$category.$resource_.$entityId.tsx`;
- `src/lib/queries.ts`;
- migrations de suporte e entrada de súmula manual.

Pode ser aproveitado como referência conceitual:

- um contexto de competição que expõe capacidades para a interface;
- seleção explícita entre apresentação completa e simplificada;
- tabelas de súmula com cestas convertidas por período;
- registro de faltas P, U, T e D;
- uso do mesmo shell público com componentes diferentes conforme a capacidade;
- consulta conjunta dos números de camisa vindos de súmula e boxscore no perfil global.

Não será copiado:

- `has_full_stats` como booleano isolado na edição;
- consulta da página simplificada apenas em `boxscores`;
- exclusão mútua rígida que impede súmula e boxscore no mesmo jogo;
- criação automática de um novo jogo ao confirmar cada fonte;
- publicação imediata da súmula;
- preenchimento de dados ausentes como zero.

Conclusão: o `site-bask` valida a estratégia de **capacidades + dois desenhos**, mas seu modelo de ingestão não resolve o cenário raro de exceção e substituição posterior. A Base do Basquete precisa manter a própria arquitetura transacional.

## 4. Vocabulário obrigatório

| Termo | Significado |
| --- | --- |
| Série | Linha do campeonato, como Copa ES Ouro, Prata ou Bronze |
| Categoria | Recorte esportivo, como Adulto, Sub-22 ou Sub-17 |
| Naipe | Divisão pública da disputa: Masculino ou Feminino |
| Sexo do atleta | Dado administrativo privado usado somente para elegibilidade; não é conteúdo público |
| Perfil de dados | Configuração versionada da combinação série + categoria + naipe |
| Fonte primária | Meio normalmente esperado: súmula manual ou boxscore PDF de contrato versionado |
| Edição | Ocorrência anual de uma combinação série + categoria + naipe |
| Jogo | Identidade esportiva única vinculada a um confronto |
| Submissão | Entrada versionada de dados de um jogo, por súmula ou boxscore |
| Autoridade de domínio | Submissão atualmente válida para um conjunto de fatos do jogo |
| Fallback | Súmula emergencial em edição cuja fonte primária é boxscore |
| Suplemento | Boxscore raro que enriquece um jogo em edição cuja fonte primária é súmula |
| Cobertura | Quantidade de jogos que realmente possuem determinado conjunto de dados |

“Fonte primária” nunca será usada como sinônimo de “única fonte permitida”.

## 5. Modelo de configuração por série + categoria + naipe

### 5.1. Tabela versionada

Criar `series_category_data_profiles` com, no mínimo:

- `id`;
- `series_id`;
- `category_id`;
- `gender_division`: `male` ou `female`;
- `version` crescente dentro do par;
- `primary_source`: `manual_scoresheet` ou `fiba_boxscore`; o segundo é o identificador interno legado apresentado como `Boxscore PDF` e abrange apenas formatos documentados;
- `status`: `draft`, `active` ou `superseded`;
- `change_reason` obrigatório a partir da versão 2;
- `created_by`, `created_at`, `activated_by`, `activated_at`;
- unicidade de `(series_id, category_id, gender_division, version)`;
- índice parcial garantindo somente uma versão ativa por combinação.

Perfis ativados são imutáveis. Alterar a fonte cria uma nova versão.

### 5.2. Vínculo da edição

Adicionar a `competitions`:

- `data_profile_id` apontando para a versão imutável;
- `data_profile_review_required` para registros migrados que ainda exigem confirmação;
- `data_profile_validated_at` e `data_profile_validated_by`.

Adicionar a `competitions` o campo obrigatório `gender_division`, com valores internos `male` e `female` e rótulos públicos “Masculino” e “Feminino”. A identidade única passa a ser `(series_id, category_id, gender_division, year)`.

O banco valida que o perfil e a edição têm o mesmo `series_id`, `category_id` e `gender_division`.

Uma edição existente não muda de comportamento quando o padrão global recebe nova versão. A alteração só alcança:

- novas edições criadas depois da ativação; ou
- edição escolhida explicitamente no fluxo de revisão e publicação.

### 5.3. Fluxo na criação e edição

No passo “Série, categoria e naipe”, mostrar:

```text
Fonte primária dos jogos

(•) Súmula manual
    Pontos, cestas convertidas, participação e faltas.

( ) Boxscore PDF
    Cobertura conforme as métricas realmente fornecidas pelo contrato do formato.
```

Comportamento:

- se existe perfil ativo, a opção vem pré-selecionada e identificada como padrão daquela combinação;
- o administrador pode escolher outra opção antes de criar a edição;
- escolher outra opção cria uma nova versão de perfil somente após revisão explícita;
- se não existe perfil, a escolha é obrigatória;
- a interface nunca sugere a fonte com base em palavras como “Ouro”, “Sub-22”, “Masculino” ou “Feminino”;
- a revisão mostra série, categoria, naipe, fonte e impacto público;
- a edição nasce privada mesmo depois da escolha.

### 5.4. Alteração com jogos existentes

Se a edição já possuir submissões:

1. calcular contagem de jogos por fonte e estado;
2. calcular quais páginas e métricas mudariam;
3. exigir justificativa;
4. criar nova versão de perfil em `draft`;
5. não reinterpretar submissões antigas;
6. exigir validação e publicação da alteração;
7. preservar a versão anterior para auditoria e rollback editorial.

A alteração é bloqueada enquanto existir conflito de fonte não resolvido ou importação em revisão.

### 5.5. Naipe, sexo e privacidade do atleta

O naipe pertence à edição e é público. O sexo pertence ao cadastro privado do atleta e é administrativo.

Modelo:

- `competitions.gender_division` obrigatório: `male` ou `female`;
- `private.player_private.sex` anulável durante a migração e restrito a `male` ou `female`;
- novos atletas só podem ser confirmados com `sex` informado;
- atletas históricos com `sex = null` permanecem públicos normalmente, mas não podem receber nova inscrição/transferência até revisão administrativa;
- o valor não será duplicado em `public.players`, elencos, submissões, views públicas ou documentos de publicação.

Elegibilidade:

- edição masculina aceita somente atleta com `sex = male`;
- edição feminina aceita somente atleta com `sex = female`;
- a validação acontece na mesma transação da inclusão no elenco, da criação inline e da confirmação de importação;
- divergência retorna código de domínio estável e mensagem administrativa curta;
- elenco histórico incompatível não é apagado automaticamente; entra em relatório de revisão e permanece preservado até decisão explícita;
- alteração de sexo em atleta com histórico exige AAL2, justificativa, prévia das inscrições afetadas e auditoria sem registrar o valor anterior ou novo.

Privacidade:

- somente RPC/serviço server-side autorizado consulta ou altera o campo;
- acesso exige administrador singleton em AAL2;
- nenhuma policy permite leitura anônima ou por usuário autenticado comum;
- o navegador recebe apenas `eligible: true/false` ou um erro de elegibilidade, nunca o sexo armazenado, salvo no formulário administrativo específico de cadastro/edição do atleta;
- busca pública e busca administrativa genérica não retornam o campo;
- logs, eventos, auditoria, observabilidade e rascunhos não registram o valor;
- exports e APIs públicas não incluem a coluna;
- varreduras de contrato devem provar que o campo não aparece nos tipos/DTOs públicos.

Experiência administrativa:

- criação global de atleta apresenta “Sexo para elegibilidade” como campo obrigatório, sem opção pré-selecionada;
- criação inline dentro de uma edição também exige escolha explícita e mostra o naipe da edição ao lado;
- importação nunca deduz o sexo a partir do PDF ou do campeonato;
- atleta existente com sexo nulo exige completar o cadastro privado antes de confirmar uma nova associação;
- atleta existente incompatível não pode ser associado e recebe mensagem “Atleta não elegível para o naipe desta edição”, sem expor o valor armazenado fora do formulário específico;
- o campo não participa da busca nem aparece em tabelas gerais de atletas; a lista administrativa pode mostrar apenas “Elegibilidade pendente” quando estiver nulo.

O campo representa a informação administrativa usada para a regra esportiva do naipe e não será apresentado como identidade de gênero.

### 5.6. Rotas e identificação pública

Como poderão existir duas edições da mesma série, categoria e ano, a rota pública canônica precisa incluir o naipe:

```text
/{ano}/{serie}/{categoria}/{naipe}/{recurso}
```

Exemplos:

```text
/2026/copa-es-ouro/adulto/masculino/jogadores
/2026/copa-es-ouro/adulto/feminino/jogadores
```

Regras:

- breadcrumbs, títulos, cartões, busca, sitemap e query keys incluem o naipe;
- páginas administrativas continuam usando `competitionId`, mas exibem o naipe no cabeçalho;
- URL legada sem naipe redireciona automaticamente somente quando existir uma única edição pública compatível;
- se existirem Masculino e Feminino, a URL legada mostra seleção de naipe e não escolhe arbitrariamente;
- slugs públicos permitidos são `masculino` e `feminino`;
- cache e canonicals não podem compartilhar chave entre os dois naipes.

## 6. Separação entre jogo e entrada de dados

### 6.1. Identidade única do jogo

O jogo deve existir uma única vez e ser criado pelo regulamento/confronto ou por um fluxo histórico controlado. Súmula e boxscore passam a anexar dados ao mesmo `game_id`.

`games.source` será mantido temporariamente apenas para compatibilidade e backfill. Nenhuma regra nova consultará esse campo como autoridade.

### 6.2. Submissões versionadas

Criar `game_data_submissions` com:

- `id` e `game_id`;
- `source_type`: `manual_scoresheet`, `fiba_boxscore` ou `legacy_seed`; `fiba_boxscore` é mantido como identificador interno legado de qualquer boxscore PDF suportado, e o terceiro valor existe somente para backfill e não aparece na interface;
- `role`: `primary`, `fallback` ou `supplemental`;
- `status`: `draft`, `review`, `validated`, `active`, `rejected` ou `superseded`;
- `parser_version`, `payload_hash`, `storage_object_id` quando aplicável;
- `reason` obrigatório para fallback e rejeição;
- `submitted_by`, `submitted_at`, `validated_by`, `validated_at`;
- chave idempotente por fluxo;
- restrições que impeçam mais de uma submissão ativa da mesma fonte e versão para o mesmo jogo.

O PDF permanece privado. A súmula preserva seu hash e payload auditável permitido, sem armazenar segredo ou dado desnecessário.

Criar também a view `game_data_status`, derivada do perfil esperado, das submissões e das autoridades ativas. Ela retorna `ready`, `awaiting_primary_source`, `review` ou `conflict`. Esse estado não será gravado em `games` e não poderá divergir das submissões.

### 6.3. Domínios de autoridade

Criar `game_data_domain_authority`, com uma linha ativa por jogo e domínio:

- `official_result`;
- `period_scores`;
- `participation`;
- `player_scoring`;
- `player_advanced`;
- `player_foul_total`;
- `player_foul_timeline`;
- `team_advanced`;
- `game_advanced`.

Cada linha aponta para a submissão ativa e registra quem validou a troca. O banco impede que uma submissão assuma domínio que sua fonte não consegue fornecer.

Capacidades:

| Domínio | Súmula manual | Boxscore PDF |
| --- | ---: | ---: |
| Resultado oficial | Sim | Sim |
| Placar por período | Sim | Quando fornecido pelo contrato |
| Participação/relacionados | Sim | Sim |
| Pontos e cestas convertidas | Sim | Sim |
| Tentativas e métricas avançadas do atleta | Não | Quando fornecidas pelo contrato |
| Total de faltas | Sim | Sim |
| Cronologia/tipo de falta | Sim | Não confiável |
| Estatísticas coletivas avançadas | Não | Quando fornecidas pelo contrato |
| Estatísticas gerais da partida | Não | Quando fornecidas pelo contrato |

O boxscore não deve criar uma cronologia fictícia de faltas no primeiro período. Quando o PDF fornece apenas o total, a precisão será `game_total` e não `timeline`.

### 6.4. Dados ausentes não são zero

As views públicas terão metadados de disponibilidade. Um valor não fornecido pela fonte será `null`/indisponível, nunca zero inferido.

Em especial:

- súmula fornece cestas convertidas, mas não tentativas;
- não calcular 2P%, 3P%, LL% ou aproveitamento geral a partir de súmula;
- não usar `tentativas = convertidas`;
- não calcular eficiência, rebotes, assistências, roubos, tocos, erros, minutos ou +/- para jogos sem boxscore;
- zero só significa que a fonte autoritativa forneceu o campo e o valor foi realmente zero.

## 7. Fluxos completos por fonte primária

### 7.1. Edição primária de súmula

Fluxo normal:

1. jogo é criado/agendado no confronto;
2. administrador abre “Registrar súmula”;
3. sistema anexa uma submissão manual ao jogo existente;
4. placar, períodos, participação, pontuação e faltas são conferidos;
5. submissão é validada;
6. domínios compatíveis passam a apontar para ela;
7. resultado pode resolver o confronto;
8. publicação continua em etapa editorial separada.

Boxscore raro:

1. PDF é anexado ao mesmo jogo como `supplemental`;
2. parser compara participantes, placar, períodos e pontuação;
3. divergências são exibidas campo a campo;
4. domínios avançados podem ser ativados após validação;
5. resultado e cronologia da súmula permanecem autoridades por padrão;
6. dados avançados ficam disponíveis no detalhe daquele jogo;
7. a página de jogadores da edição continua no desenho de súmula.

### 7.2. Edição primária de boxscore

Fluxo normal:

1. jogo é criado/agendado no confronto;
2. PDF é enviado e processado no servidor;
3. importação fica em revisão;
4. equipes, atletas, jogo e placar são reconciliados;
5. confirmação ativa todos os domínios suportados;
6. página atual de boxscore continua sendo usada.

Súmula de emergência:

1. ação secundária “Registrar súmula emergencial”;
2. exigir motivo curto;
3. criar submissão `fallback` no mesmo jogo;
4. marcar o jogo como `awaiting_primary_source` sem alterar seu estado esportivo;
5. permitir validar resultado, participação, pontuação e faltas para não bloquear o campeonato;
6. publicar somente os dados validados e compatíveis;
7. não apresentar métricas avançadas ausentes como zero.

Chegada posterior do PDF:

1. deduplicar pelo hash e vincular ao mesmo jogo;
2. comparar fonte, participantes, placar, períodos, pontos por atleta e camisa;
3. se os campos comuns coincidirem, sugerir promoção do boxscore;
4. se houver divergência, bloquear a promoção e mostrar diferenças;
5. após validação, ativar domínios avançados e, se aprovado, os domínios comuns;
6. manter a súmula como revisão `superseded`, nunca apagá-la;
7. retirar a marca `awaiting_primary_source` somente quando os domínios obrigatórios do boxscore estiverem ativos.

Se o PDF nunca chegar, um administrador poderá confirmar explicitamente a súmula como fallback definitivo. O jogo continuará contabilizado, mas a cobertura avançada permanecerá incompleta.

## 8. Conciliação, correções e progressão

### 8.1. Comparação obrigatória

O comparador de submissões verificará:

- mesma edição e mesmo confronto;
- mesmo número de jogo, quando informado;
- duas inscrições compatíveis;
- mandante/visitante ou inversão permitida pelo confronto;
- placar final;
- placar por período;
- atletas relacionados;
- pontos por atleta;
- cestas convertidas compatíveis;
- números de camisa como aviso, não como identidade do atleta.

### 8.2. Resultado consumido pelo regulamento

A progressão automática consulta somente `official_result` ativo e validado.

- submissão `draft` ou `review` nunca classifica equipe;
- fallback manual validado pode resolver o confronto;
- PDF posterior com o mesmo resultado apenas enriquece os dados;
- PDF posterior com resultado diferente bloqueia a troca automática;
- se o confronto dependente ainda não começou, usar correção auditada e recalcular dependências;
- se o confronto dependente já começou, exigir emenda/decisão administrativa específica;
- nada reescreve silenciosamente o caminho do campeonato.

### 8.3. Idempotência e concorrência

- uma mesma súmula repetida devolve a submissão existente;
- um mesmo hash de PDF não cria novo import;
- duas confirmações concorrentes não podem ativar autoridades diferentes para o mesmo domínio;
- bloqueios transacionais seguem ordem determinística;
- o frontend nunca escolhe sozinho a autoridade final.

## 9. Dois desenhos da página de jogadores

### 9.1. Seleção do desenho

O loader resolve o `data_profile_id` da edição e retorna um DTO discriminado:

- `kind: "boxscore"` para fonte primária `fiba_boxscore`;
- `kind: "scoresheet"` para fonte primária `manual_scoresheet`.

A escolha não usa `categories.has_advanced_stats`, não conta jogos e não muda conforme a última importação.

### 9.2. Página atual de boxscore

No cenário normal de cobertura completa, não alterar:

- estrutura visual;
- busca;
- totais/por jogo;
- presets e colunas;
- filtros avançados;
- comparação;
- ordenação e paginação;
- métricas e nomenclatura;
- comportamento responsivo e URL.

As mudanças internas permitidas são:

- trocar a origem da capacidade para o perfil série + categoria + naipe;
- filtrar somente autoridades ativas;
- excluir jogos manuais dos denominadores de métricas avançadas;
- incluir pontos e jogos do fallback nos campos básicos;
- mostrar aviso excepcional de cobertura apenas quando faltar boxscore.

Aviso excepcional:

> Estatísticas avançadas disponíveis em 8 de 9 jogos. Um jogo foi registrado por súmula enquanto o boxscore é aguardado.

O aviso não aparece com cobertura completa; portanto, a página atual permanece visualmente inalterada na situação usual.

### 9.3. Nova página de súmula

A nova página será o desenho principal para a maioria dos campeonatos. Ela deve ser mais simples, informativa e verticalmente econômica.

Cabeçalho:

- título “Jogadores”;
- identificação da série, categoria, naipe e ano;
- texto curto “Dados registrados por súmula”;
- quantidade de atletas com participação;
- sem explicações técnicas sobre banco, parser ou fonte.

Controles:

- busca por atleta ou equipe;
- filtro de equipe;
- ordenação por qualquer coluna disponível;
- nenhum filtro avançado;
- nenhum seletor de colunas;
- nenhum comparador avançado;
- estado da busca preservado na URL.

Tabela desktop:

| Coluna | Regra |
| --- | --- |
| Posição | Derivada da ordenação atual |
| Jogador | Link contextual para o perfil |
| Equipe | Sigla e nome acessível |
| J | Jogos em que participou, sem contar DNP |
| PTS | Total de pontos |
| PTS/J | Pontos divididos por jogos, nulo sem jogos |
| 2PC | Cestas de 2 convertidas |
| 3PC | Cestas de 3 convertidas |
| LLC | Lances livres convertidos |
| F | Total de faltas registradas |
| GD | Quantidade de desqualificações, exibida apenas se houver ao menos uma na edição |

Ordenação inicial: `PTS` decrescente, desempate por `PTS/J`, jogos e nome.

No celular:

- atleta, equipe, PTS, PTS/J e J ficam sempre visíveis;
- 2PC, 3PC, LLC, F e GD aparecem em expansão por linha ou rolagem contida;
- não haverá tabela maior que o documento;
- o cabeçalho não ocupa mais de duas linhas antes dos controles.

Não exibir:

- minutos;
- tentativas;
- percentuais de arremesso;
- rebotes;
- assistências;
- roubos;
- tocos;
- erros;
- eficiência;
- +/-;
- comparação avançada;
- qualquer zero que signifique “não informado”.

### 9.4. Perfil contextual do jogador em edição de súmula

O perfil contextual terá:

- nome, equipe e camisa da edição;
- jogos, pontos e média;
- 2PC, 3PC e LLC;
- faltas e desqualificações;
- histórico por jogo com data, adversário, placar, pontos, cestas convertidas e faltas;
- indicador DNP quando o atleta foi relacionado e não jogou;
- link para a página do jogo.

O perfil global do atleta pode reunir temporadas de ambas as fontes, mas cada bloco deve respeitar sua capacidade. Estatísticas avançadas nunca serão agregadas como se todas as temporadas tivessem a mesma cobertura.

### 9.5. Boxscore raro em edição de súmula

Para o ranking da edição, o boxscore será projetado para o subconjunto compatível:

- participação;
- pontos;
- 2PC;
- 3PC;
- LLC;
- total de faltas.

Dados avançados continuam disponíveis somente no detalhe daquele jogo. Isso mantém comparabilidade entre todos os atletas da edição.

## 10. Read models e contrato de cobertura

Criar read models separados, sem um DTO cheio de campos opcionais ambíguos:

- `competition_scoresheet_player_statistics`;
- `competition_boxscore_player_statistics`;
- `game_scoresheet_player_statistics`;
- `game_boxscore_player_statistics`;
- `competition_data_coverage`;
- `game_active_data_sources`.

Cada view pública:

- considera apenas edição e jogo editorialmente publicados;
- considera somente submissões/domínios ativos;
- exclui DNP de jogos disputados;
- não soma duas fontes para o mesmo domínio;
- preserva equipe e camisa por edição;
- retorna cobertura para métricas avançadas;
- usa `security_invoker`, RLS e grants mínimos.

O read model de boxscore separa explicitamente:

- `games_played`: todos os jogos com participação e pontuação oficial ativa;
- `advanced_games_played`: somente jogos com domínio `player_advanced` ativo;
- `official_points`: pontos oficiais de todos os jogos;
- `advanced_points`: pontos dos jogos que também possuem dados avançados;
- tentativas, rebotes, assistências e demais métricas somente dos jogos avançados.

Na escala “por jogo”, PTS usa `games_played`; métricas avançadas e eficiência usam `advanced_games_played`. Percentuais usam somente somas reais de convertidas/tentadas dos boxscores ativos. Assim, uma súmula de fallback participa da pontuação sem reduzir artificialmente médias avançadas nem produzir eficiência incorreta.

O DTO `simple` atual será substituído por `scoresheet`, não apenas renomeado. A página avançada continua recebendo o formato existente para evitar regressão visual.

## 11. Migração e backfill sem interrupção

### 11.1. Estratégia aditiva

1. adicionar `competitions.gender_division` anulável somente para permitir backfill histórico;
2. adicionar `private.player_private.sex` anulável e sem grants públicos;
3. criar tabelas, enums/checks, índices e RLS novos;
4. adicionar FKs anuláveis;
5. gerar perfis e submissões históricas;
6. comparar contagens e resultados;
7. publicar novas views e rotas com naipe;
8. mudar loaders atrás de seleção explícita;
9. tornar naipe/FKs obrigatórios somente depois da reconciliação;
10. manter colunas e rotas legadas até o fim do rollout.

O Pacote 1 será dividido em três migrations ordenadas:

1. **compatibilidade:** colunas anuláveis, tabelas privadas/perfis, RLS, RPCs e resolver legado;
2. **classificação/backfill:** persistir escolhas administrativas de naipe, criar perfis correspondentes e reconciliar sexo/elegibilidade sem alterar o histórico;
3. **enforcement:** somente com filas zeradas, tornar naipe obrigatório, ativar unicidades/FKs finais e remover o resolver legado do caminho de novas escritas.

A terceira migration não será enviada/aplicada enquanto o relatório de pendências não estiver zerado no ambiente alvo.

### 11.2. Backfill de naipe e sexo

Não inferir naipe ou sexo por nome, equipe, categoria, imagem, apelido ou estatística.

- edições existentes começam com `gender_division = null` e `gender_division_review_required = true`;
- a interface administrativa oferece revisão em lote, exigindo Masculino ou Feminino para cada edição;
- nenhuma versão ativa de perfil é criada para uma edição enquanto o naipe estiver indefinido; `data_profile_id` permanece nulo e `data_profile_review_required` permanece verdadeiro;
- enquanto não revisada, a edição mantém a rota e a apresentação pública legadas, sem rótulo inventado;
- o resolver legado usa temporariamente o comportamento público anterior, mas bloqueia nova publicação ou alteração esportiva até concluir naipe e perfil;
- novas edições exigem naipe no RPC desde o primeiro deploy;
- depois que todas as edições forem classificadas e reconciliadas, tornar `gender_division` obrigatório e ativar a unicidade série + categoria + naipe + ano;
- atletas existentes começam com `sex = null` quando o dado não estiver disponível de forma explícita;
- o histórico público permanece visível;
- nova inscrição, transferência, criação inline ou associação de import exige o preenchimento administrativo do sexo;
- o backfill é auditado por IDs e ação, sem incluir os valores nos logs/auditoria genérica.

### 11.3. Regra determinística de classificação histórica da fonte

Para cada edição:

| Dados encontrados | Perfil inicial | Revisão |
| --- | --- | --- |
| Somente jogos boxscore | Boxscore | Confirmado automaticamente |
| Somente jogos manuais | Súmula | Confirmado automaticamente |
| Jogos boxscore e manuais | Valor legado de `has_advanced_stats` | Obrigatória |
| Nenhum jogo | Valor legado de `has_advanced_stats` | Obrigatória |

Edições mistas ou vazias preservam a apresentação pública atual até a validação. Não ficam invisíveis nem mudam de desenho durante a migration.

Se edições da mesma combinação série + categoria + naipe produzirem perfis divergentes:

- criar snapshots históricos por edição;
- não eleger automaticamente um padrão ativo global;
- exigir que o administrador defina o padrão antes da próxima edição daquela combinação.

### 11.4. Submissões históricas

- cada jogo `source = manual` recebe uma submissão manual ativa;
- cada jogo `source = boxscore` recebe uma submissão boxscore ativa;
- `seed` recebe submissão `legacy_seed` apenas durante a migration e entra em fila de revisão;
- domínios são preenchidos conforme a capacidade real;
- hashes e imports existentes são preservados;
- IDs de jogos, participantes, elencos, períodos, placares, faltas e estatísticas não mudam.

### 11.5. Reconciliação obrigatória

Antes e depois:

- total de edições;
- edições por naipe e pendências de revisão;
- atletas com sexo definido e pendências privadas;
- total de jogos por origem/status;
- placar final de cada jogo;
- pontos por atleta e por equipe;
- relacionados e DNP;
- faltas e desqualificações;
- hashes de imports;
- contagem de jogos usada na classificação;
- cobertura avançada por edição.

Qualquer diferença não explicada bloqueia o rollout.

## 12. Administração da fonte de dados

### 12.1. Resumo no hub

Mostrar um cartão compacto:

```text
Dados dos jogos
Fonte primária: Súmula manual
12 jogos validados · 1 pendência · 0 conflitos
```

Ações:

- “Alterar configuração”;
- “Ver pendências”;
- “Importar boxscore” ou “Registrar súmula”, priorizada conforme o perfil;
- ação de exceção em menu secundário.

### 12.2. Lista de jogos

Cada jogo mostra, sem excesso:

- confronto/rodada;
- participantes;
- estado esportivo;
- estado editorial;
- fonte esperada;
- fonte ativa;
- pendência excepcional;
- conflito que exige revisão.

### 12.3. Revisão de conflito

Tela em três blocos:

1. resumo do jogo;
2. diferenças somente nos campos divergentes;
3. escolha de autoridade por domínio compatível.

Não permitir selecionar uma fonte para um domínio que ela não fornece. A confirmação mostra exatamente o que será alterado e o que permanecerá preservado.

## 13. Integração com criação, regulamento e publicação

O fluxo de criação passa a ser:

1. série, categoria, naipe e ano;
2. fonte primária da combinação;
3. período e contexto histórico/futuro;
4. regulamento padrão, edição anterior ou modelo básico;
5. revisão de novo ano, fonte e privacidade;
6. criação em rascunho;
7. configuração de equipes, confrontos e jogos;
8. validação editorial separada.

O regulamento continua responsável por indicar se o jogo pertence a classificatória, grupos, repescagem, eliminatória, colocação, ida/volta ou melhor de N. A fonte de dados não altera o tipo esportivo do jogo.

Modelos de regulamento e clonagem da edição anterior também são filtrados por série + categoria + naipe. Copiar estrutura de outro naipe exige escolha explícita e recompilação completa; nunca ocorre por padrão.

## 14. Prioridades de produto

### P0 — bloqueadores de integridade

- naipe obrigatório na identidade da edição;
- sexo do atleta em armazenamento privado e validação de elegibilidade;
- perfil versionado série + categoria + naipe;
- separação jogo/submissão;
- autoridade por domínio;
- dados ausentes diferentes de zero;
- backfill e reconciliação;
- adaptação de súmula/boxscore ao mesmo jogo;
- atualização do `HANDOFF.md`.

### P1 — experiência essencial

- seleção da fonte na criação/edição;
- hub e pendências de fonte;
- fallback manual e suplemento boxscore;
- nova página de jogadores de súmula;
- perfil contextual de súmula;
- preservação/regressão da página boxscore;
- accordion de equipes;
- criação de edição e novo ano;
- publicação validada.

### P2 — núcleo esportivo flexível

- regulamento versionado;
- confrontos, vagas e partidas;
- progressão automática validada;
- W.O., desistência, correção e emenda;
- bloqueio de terceiro confronto de semifinal;
- publicação temporal de jogos.

### P3 — refinamento

- indicadores operacionais e filtros de pendência;
- relatório histórico de cobertura;
- melhorias de desempenho após medição;
- polimento responsivo e acessível adicional.

P3 não pode atrasar correções de integridade P0/P1.

## 15. Pacotes de execução retomáveis

Toda execução ocorre na PR draft #35, salvo se a auditoria inicial mostrar que ela foi fechada, integrada ou se tornou incompatível. Nesse caso, o `HANDOFF.md` registra a razão antes de abrir outra PR.

### Pacote 0 — reconciliar branch, PR e documentação

**Contexto:** entrega/Git
**Prioridade:** P0
**Dependência:** nenhuma

Entregas:

- reconciliar `git status`, log, PR #35 e previews;
- preservar mudanças existentes e o arquivo não rastreado identificado;
- importar este plano para `docs/plan/` e atualizar seu README;
- atualizar o `HANDOFF.md` real;
- definir checklist da PR por pacote;
- executar gate inicial proporcional.

Checkpoint: documentação e estado remoto coerentes; próximo arquivo e teste registrados.

### Pacote 1 — naipe, sexo privado e perfil de dados

**Contexto:** banco, domínio e admin
**Prioridade:** P0
**Dependência:** pacote 0

Entregas:

- migration aditiva de `gender_division` e `private.player_private.sex`;
- fila de revisão de naipe/sexo sem inferência automática;
- migration de `series_category_data_profiles`;
- vínculo versionado em `competitions`;
- RLS, grants, constraints e RPC de ativação;
- backfill determinístico;
- contexto público/admin baseado no perfil;
- testes pgTAP e Vitest;
- seleção de naipe/fonte na página de edição/criação;
- adaptação mínima dos formulários global e inline de atleta para coletar sexo privadamente, sem valor padrão;
- validação privada de elegibilidade nas inscrições e importações.

Checkpoint: nenhuma rota nova depende de `categories.has_advanced_stats`; Masculino/Feminino não colidem; sexo não aparece em nenhum contrato público; compatibilidade pública preservada.

### Pacote 2 — submissões e autoridade por domínio

**Contexto:** banco e ingestão
**Prioridade:** P0
**Dependência:** pacote 1

Entregas:

- `game_data_submissions`;
- `game_data_domain_authority`;
- fundação mínima de confronto e vínculo `games.matchup_id`, incluindo invólucro `legacy_unclassified` para o histórico;
- bloqueio de qualquer novo jogo sem confronto válido a partir da ativação da migration;
- view derivada `game_data_status`, incluindo `awaiting_primary_source`, separada do status esportivo;
- backfill de jogos manuais, boxscore e seed;
- RPCs idempotentes de validação/ativação;
- relatório de cobertura;
- testes de concorrência e RLS.

Checkpoint: jogo único aceita revisões das duas fontes sem duplicar fatos ativos.

### Pacote 3 — adaptar súmula e boxscore ao jogo existente

**Contexto:** ingestão e administração
**Prioridade:** P0/P1
**Dependência:** pacote 2

Entregas:

- remover criação implícita de jogos das confirmações novas;
- selecionar/vincular jogo e confronto;
- fluxo normal conforme o perfil;
- súmula emergencial com motivo;
- boxscore suplementar;
- comparação campo a campo;
- promoção, rejeição e supersessão preservando histórico;
- erros de domínio em português.

Checkpoint: cenários normal, fallback e suplemento aprovados ponta a ponta.

### Pacote 4 — nova página de jogadores de súmula

**Contexto:** read models e área pública
**Prioridade:** P1
**Dependência:** pacotes 1 e 2

Entregas:

- views de súmula;
- DTO `scoresheet`;
- novo componente da listagem;
- perfil contextual por súmula;
- estados vazio/erro/carregamento;
- projeção compatível do boxscore raro;
- responsividade e acessibilidade;
- testes unitários, integração e navegador.

Checkpoint: edição manual exibe apenas métricas confiáveis e todos os atletas pontuadores/participantes esperados.

### Pacote 5 — regressão zero da página de boxscore

**Contexto:** área pública
**Prioridade:** P1
**Dependência:** pacotes 1, 2 e 4

Entregas:

- manter componente e contrato visual existentes;
- substituir somente a resolução de capacidade/autoridade;
- cobertura avançada para fallback manual;
- aviso excepcional condicional;
- snapshots/QA comparando antes e depois;
- testes de percentuais e denominadores.

Checkpoint: com 100% de boxscore, a página permanece equivalente ao estado aprovado da PR #34/#35.

### Pacote 6 — criação, hub e equipes

**Contexto:** painel administrativo
**Prioridade:** P1
**Dependência:** pacote 1

Entregas:

- navegação Competições/Equipes/Atletas/Segurança;
- criação histórica e futura;
- aviso de primeiro campeonato no ano;
- naipe e fonte no fluxo série + categoria + naipe;
- hub compacto;
- accordion com todas as equipes recolhidas;
- cadastro/edição privada de sexo e pendência de elegibilidade no fluxo de atletas/elencos;
- remoção/retirada segura;
- resumo de pendências e publicação.

Checkpoint: fluxo administrativo completo em 390 px e desktop, com teclado e AAL2.

### Pacote 7 — regulamento e progressão

**Contexto:** núcleo esportivo
**Prioridade:** P2
**Dependência:** pacotes 2 e 6

Entregas:

- revisões imutáveis;
- trilhas, etapas, rodadas, vagas, confrontos e partidas;
- contratos de oitavas/quartas/semifinal/final;
- ida/volta e melhor de N ímpar;
- progressão explícita após validação;
- W.O., desistência e decisão administrativa;
- correção e emenda;
- ligação das fontes ao jogo do confronto.

Checkpoint: resultado ativo preenche o confronto seguinte uma única vez e não publica jogo.

### Pacote 8 — publicação e proteção temporal

**Contexto:** editorial, RLS e público
**Prioridade:** P1/P2
**Dependência:** pacotes 3, 6 e 7

Entregas:

- revisão calculada das mudanças;
- edição e jogos privados até validação;
- `starts_on` autoritativo em `America/Sao_Paulo`;
- URLs/listagens/busca filtradas de forma uniforme;
- republicação versionada após alterações;
- testes temporais.

Checkpoint: data inicial libera a ação, mas nunca publica automaticamente.

### Pacote 9 — consolidação da PR

**Contexto:** qualidade e entrega
**Prioridade:** P0
**Dependência:** todos os pacotes necessários ao escopo aprovado

Entregas:

- migrations desde zero e sobre base representativa;
- pgTAP, Vitest, lint, formatação, typecheck, build e scan de segredos;
- QA autenticado e público;
- preview PR #35;
- reconciliação histórica;
- documentação e `HANDOFF.md` finais;
- descrição/checklist/evidências da PR atualizados.

Checkpoint: PR permanece draft para revisão; nenhum merge ou deploy de produção.

## 16. Protocolo obrigatório de `HANDOFF.md`

Atualizar o `HANDOFF.md` real:

- no início, após reconciliar o estado;
- ao concluir cada pacote;
- após migration, decisão arquitetural ou mudança de estado remoto;
- antes de interromper por limite de tokens, tempo, sessão ou ambiente;
- ao encontrar bloqueio;
- antes de entregar a PR para revisão.

Formato mínimo:

```text
Pacote atual:
Branch e commit:
PR e base:
Concluído nesta sessão:
Arquivos/migrations alterados:
Decisões tomadas:
Testes executados e resultado real:
Estado do banco/preview:
Pendências e riscos:
Mudanças não commitadas:
Próximo passo exato: arquivo + ação + validação esperada
```

Nenhuma decisão essencial pode ficar apenas no chat. Antes de parar, concluir a menor unidade segura, testar o possível, executar `git status`, atualizar o handoff e fazer commit/push WIP somente na branch da PR quando apropriado.

## 17. Matriz mínima de testes

### Banco e segurança

- duas edições do mesmo ano/série/categoria coexistem quando o naipe difere;
- duplicidade do mesmo ano/série/categoria/naipe é recusada;
- um perfil ativo por série + categoria + naipe;
- edição só aceita perfil da mesma combinação;
- perfil ativo é imutável;
- duas ativações concorrentes não vencem juntas;
- uma autoridade ativa por jogo/domínio;
- fonte incapaz não assume domínio avançado;
- repetição idempotente não duplica submissão;
- anon, autenticado comum, admin AAL1 e admin AAL2;
- RLS de dados privados/draft;
- PDF privado e hash preservado.
- sexo ausente bloqueia nova inscrição, mas não apaga histórico;
- masculino não entra em edição feminina e feminino não entra em edição masculina;
- sexo não aparece em view, DTO, busca, API, log, auditoria ou rascunho público;
- admin AAL1 e usuário comum não leem nem alteram sexo;
- alteração por admin AAL2 exige justificativa e não grava o valor na auditoria genérica.

### Súmula e boxscore

- manual primária normal;
- boxscore primário normal;
- manual primária com boxscore suplementar compatível;
- manual primária com boxscore divergente;
- boxscore primário com súmula emergencial;
- chegada posterior de PDF igual;
- chegada posterior de PDF divergente;
- fallback definitivo sem PDF;
- duas confirmações concorrentes;
- nenhum percentual de 100% fabricado;
- nenhum dado ausente convertido em zero.

### Jogadores

- desenho escolhido pelo perfil, não pela categoria;
- desenho, cache e rota isolados por naipe;
- Adulto Ouro e Adulto Prata podem ter desenhos diferentes;
- Sub-22 e outra categoria podem ter desenhos diferentes;
- página de súmula mostra J, PTS, PTS/J, 2PC, 3PC, LLC, F e GD;
- DNP não incrementa jogos;
- boxscore raro entra somente na projeção compatível;
- fallback manual não contamina denominador avançado;
- página boxscore com cobertura total não sofre alteração visual;
- busca, equipe, ordenação, paginação, teclado e 390 px;
- perfil contextual e global não misturam capacidades.

### Regulamento e publicação

- semifinal aceita no máximo dois confrontos por trilha;
- progressão ocorre uma vez após validação;
- draft/review não progride;
- correção antes e depois de dependente iniciado;
- competição futura pode ser preparada;
- antes de `starts_on` não publica;
- na data não publica automaticamente;
- publicação manual gera resumo curto;
- URL direta privada não expõe dados.

## 18. Critérios de aceite da PR

A PR estará pronta para revisão quando:

- Masculino e Feminino puderem coexistir para a mesma série, categoria e ano;
- o naipe aparecer nos contextos públicos e administrativos corretos;
- o sexo do atleta permanecer privado e for validado server-side na inscrição;
- a fonte é configurada por série + categoria + naipe e versionada;
- o exemplo Copa ES suporta Adulto Ouro com boxscore e Prata/Bronze com súmula sem conflito;
- exceções por jogo coexistem no mesmo `game_id`;
- nenhuma fonte apaga a outra;
- conflitos exigem decisão explícita;
- a maioria dos campeonatos usa uma página de súmula útil e sem métricas fictícias;
- a página atual de boxscore permanece inalterada no cenário normal;
- o fallback manual não cria zeros avançados falsos;
- o PDF posterior pode enriquecer/substituir autoridades após validação;
- o regulamento continua sendo a autoridade do tipo de jogo;
- progressão e publicação continuam independentes;
- administração inteira segue o padrão visual e de redução de informação;
- migrations e backfill preservam todos os dados existentes;
- AAL2, RLS, CSRF, auditoria, idempotência e privacidade permanecem aprovados;
- todos os gates e o preview estão registrados no `HANDOFF.md` e na PR.

## 19. Atalhos proibidos

Não:

- inferir naipe ou sexo pelo nome, equipe, imagem, categoria ou estatística;
- expor sexo em rota, DTO, busca, página, log, auditoria genérica ou rascunho;
- validar elegibilidade somente no frontend;
- recolocar a fonte na raiz genérica do campeonato;
- usar somente `category.has_advanced_stats`;
- transformar “misto” em fonte primária;
- impedir exceção por jogo;
- criar segundo jogo para o mesmo confronto ao trocar a fonte;
- sobrescrever ou apagar a súmula quando o PDF chegar;
- somar as duas fontes para o mesmo domínio;
- tratar ausência como zero;
- calcular percentual com tentativas desconhecidas;
- mudar a página de boxscore normal para acomodar o desenho de súmula;
- exibir métricas avançadas em edição manual por causa de um único PDF;
- permitir que submissão não validada progrida o campeonato;
- publicar por cron ou apenas pela chegada da data;
- inferir fase por nome ou número do jogo;
- editar revisão esportiva ativa;
- abrir outra PR enquanto a #35 for o alvo válido;
- deixar o próximo passo somente na conversa;
- fazer merge ou produção sem autorização explícita.

## 20. Próximo passo após aprovação deste plano

1. abrir o repositório real e reconciliar branch/PR #35;
2. copiar este plano para `docs/plan/` e atualizar o índice;
3. atualizar imediatamente o `HANDOFF.md` real com o Pacote 0;
4. implementar o Pacote 1, começando pelo DDL de naipe, sexo privado e perfil série + categoria + naipe;
5. executar testes proporcionais, commit pequeno e push na branch existente;
6. atualizar a descrição/checklist da PR;
7. seguir pacote a pacote, sempre deixando um próximo passo exato antes de interromper.
