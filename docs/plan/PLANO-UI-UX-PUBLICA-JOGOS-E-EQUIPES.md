# Plano de implementação — UI/UX pública, jogos e equipes

**Status:** rascunho de implementação aprovado conceitualmente

**Data:** 17/09/2026

**Base técnica:** `origin/main` após a release `v1.2.0`

**Dependência externa:** concluir e integrar a PR #49 (`FEATURE-BOXSCORE-SITE-01`) antes de iniciar mudanças de código que alcancem projeções públicas de boxscore
**Escopo:** somente os itens 1, 3, 4, 6, 7, 8, 9, 10, 11 e 12 da auditoria de UI/UX, consolidados com as decisões posteriores do responsável

## 1. Objetivo

Reduzir atrito de navegação e tornar jogos, boxscores e páginas de equipes adequados à leitura esportiva, sem reabrir o escopo do MVP, alterar regras administrativas autoritativas ou criar uma segunda lógica estatística.

O trabalho será dividido em pacotes curtos e independentes. Cada pacote deverá partir da `main` atualizada, passar pelos gates aplicáveis e produzir somente preview até autorização de integração e release.

## 2. Decisões de produto fechadas

### 2.1. Nomenclatura estatística

- `AP` é o padrão do produto para arremessos de quadra.
- Usar `AP%`, nunca `FG%`.
- Usar os mesmos rótulos da tabela de jogadores em todos os contextos equivalentes:
  - `J` — jogos;
  - `PTS` — pontos;
  - `REB` — rebotes;
  - `AST` — assistências;
  - `AP%` — aproveitamento de arremessos;
  - `3P%` — aproveitamento de três pontos;
  - `LL%` — aproveitamento de lances livres;
  - `EF` — eficiência;
  - demais abreviações já existentes na tabela de jogadores quando a fonte realmente fornecer o dado.
- Não usar rótulos como `PTS/J`, `REB/J`, `AST/J` ou `EF/J`.
- A escala é comunicada pelo controle global `Por jogo` / `Total`, não pelo nome de cada coluna.
- Percentuais continuam calculados pelas somas de convertidos e tentados e não mudam entre `Por jogo` e `Total`.
- Dados ausentes permanecem `—`; nunca converter ausência em zero.

### 2.2. Navegação pública

- O nome do campeonato é um seletor de contexto, não uma aba de conteúdo.
- O seletor abre sobre o conteúdo no desktop e como painel adaptado no celular, sem aumentar a altura nem introduzir rolagem vertical na barra de abas.
- Remover `Visão geral` da navegação pública.
- `Classificação` passa a ser a primeira aba e a entrada padrão da edição.
- A marca do site, o breadcrumb inicial, a raiz e a troca de edição apontam para `Classificação`.
- A rota antiga `/visao-geral` permanece apenas como redirecionamento compatível para `/classificacao`.
- A ajuda `Siglas e critérios de desempate` deve permanecer visível, legível e operável por teclado.

### 2.3. Lista de jogos

- Um jogo por linha, em uma única coluna também no desktop.
- Ordem visual de cada item:
  1. data, horário e local;
  2. nome completo da equipe mandante;
  3. placar;
  4. nome completo da equipe visitante;
  5. ação discreta para abrir a partida.
- Remover o número técnico do jogo da apresentação principal.
- Não usar siglas das equipes no confronto quando o nome completo estiver disponível.
- Em jogo finalizado, aplicar verde à pontuação vencedora e vermelho à perdedora.
- Cor nunca será o único indicador: vencedor e perdedor também recebem distinção semântica e de peso tipográfico; leitores de tela recebem descrição explícita.
- Jogos agendados, empatados por estado inconsistente ou sem placar usam tratamento neutro.
- Remover `Ao vivo` do filtro e das etiquetas públicas atuais.
- Preservar o valor interno `live` para compatibilidade futura; esta unidade não altera enum, banco ou transições de estado.
- Manter somente filtros visuais `Todos`, `Agendados` e `Finalizados`.
- Substituir títulos de fallback como `Histórico sem fase classificada — Histórico sem rodada classificada` por uma única seção curta e neutra.

### 2.4. Detalhe da partida e boxscore

Ordem da página:

1. data, horário e local;
2. placar compacto por períodos, incluindo a coluna `Final`;
3. boxscore das duas equipes;
4. indicadores coletivos complementares.

Regras:

- O boxscore é o conteúdo principal da página.
- Remover o placar final grande e redundante; o total final fica na tabela por períodos.
- Reduzir visualmente a tabela por períodos, preservando nomes completos e leitura em telas pequenas.
- As duas tabelas de atletas ficam sempre abertas.
- Em telas amplas, ficam lado a lado em duas colunas, cada uma com rolagem horizontal contida quando necessário.
- Em telas estreitas, ficam empilhadas; não criar overflow global do documento.
- Cabeçalhos numéricos são botões de ordenação acessíveis.
- Primeiro acionamento ordena do maior para o menor; segundo, do menor para o maior; terceiro restaura a ordem oficial da súmula.
- A mesma métrica e direção serão aplicadas às duas equipes para facilitar comparação.
- Valores indisponíveis e atletas `NJ` permanecem no final da ordenação.
- Remover as tags grandes `Titular` e `Não jogou`.
- Exibir `*` antes do número de camisa do titular e uma legenda curta `* Titular`.
- Exibir `NJ` no campo de minutos de quem não entrou; demais estatísticas ficam `—`.
- Exibir capitão como `Nome do atleta (C)` quando `is_captain` estiver disponível.
- A coluna `is_captain` já existe e é persistida pelo fluxo FIBA. A implementação deve apenas incluí-la no read model/DTO público e na apresentação, sem nova migration.
- Para fontes que não informem capitão, não exibir marcador nem inferir o valor.
- A linha `Total` usa fundo neutro, borda superior e peso tipográfico; não usa preenchimento colorido forte.
- O `+/-` total da equipe não será a soma do `+/-` dos atletas. Exibir o saldo do placar ou `—`, conforme a disponibilidade e a decisão consolidada no domínio.
- Alterar `Pontos de erros` para `Pontos após erros`.

### 2.5. Estatísticas de equipes

A tabela de equipes passa a seguir o mesmo contrato visual da tabela de jogadores.

Colunas essenciais iniciais:

| Coluna | Por jogo | Total |
| --- | --- | --- |
| Equipe | nome e link | nome e link |
| J | jogos finalizados com cobertura | mesmo valor |
| PTS | pontos por jogo | pontos totais |
| REB | rebotes por jogo | rebotes totais |
| AST | assistências por jogo | assistências totais |
| AP% | convertidos/tentados agregados | mesmo percentual |
| 3P% | convertidos/tentados agregados | mesmo percentual |
| LL% | convertidos/tentados agregados | mesmo percentual |
| EF | eficiência por jogo | eficiência total |

Regras:

- Controle segmentado `Por jogo` / `Total`, com o mesmo texto e comportamento da página de jogadores.
- Modo inicial: `Por jogo`.
- O modo pode ser preservado em query string usando o mesmo vocabulário já aceito na área de jogadores.
- Os rótulos não recebem `/J`; o estado do controle informa a escala.
- Ordenação deve usar o valor exibido no modo atual.
- A implementação deve consumir a projeção correta de cada perfil de dados:
  - súmula manual: somente métricas realmente disponíveis;
  - FIBA/Genius Sports: projeção avançada autoritativa;
  - Basketball Site: somente capacidades previstas no contrato após a integração da PR #49.
- Preferir composição server-side sobre as views públicas existentes. Criar migration somente se os read models atuais não permitirem uma consulta segura, correta e eficiente.
- Se uma nova view pública for indispensável, ela deve usar `security_invoker`, grants mínimos, RLS das tabelas-base e pgTAP de acesso anônimo/contextual.

### 2.6. Página da equipe

A página individual deixa de ser um destino quase vazio e reutiliza os mesmos dados da classificação, jogos e estatísticas de equipes.

Conteúdo mínimo:

- nome da equipe e identificação da edição;
- posição atual;
- jogos, vitórias e derrotas;
- pontos pró, pontos contra e saldo;
- alternância `Por jogo` / `Total` para as estatísticas disponíveis;
- últimos resultados;
- próxima partida;
- elenco da edição;
- conquistas confirmadas;
- links contextuais para classificação, jogos filtrados e atletas.

Não duplicar regras de classificação ou agregação no componente. O loader deve compor os read models já utilizados pelas páginas correspondentes.

### 2.7. Hub administrativo

- Mover os atalhos de estrutura, agenda, dados, publicação, exceções, súmula e importação para imediatamente depois dos indicadores do hub.
- Inscrições e elencos ficam abaixo dos atalhos operacionais.
- Traduzir estados crus como `draft` antes da apresentação.
- Evidenciar pendências que bloqueiem publicação sem alterar autorização, MFA, transações ou regras de domínio.

### 2.8. Busca

- `Nesta página` e `Toda a base` não podem parecer ativas ao mesmo tempo.
- Ao mudar para busca global, limpar o texto/filtro local da interface e da URL.
- Ao retornar à busca local, fechar e limpar resultados globais.
- Preservar na URL somente o filtro que realmente governa o conteúdo renderizado.
- Não alterar o escopo de indexação pública nesta unidade.

## 3. Pacotes de implementação

### UIUX-01 — Navegação, classificação e lista de jogos

**Dependência:** `main` atualizada.

**Banco:** nenhum.
**Risco:** baixo.

Arquivos prováveis:

- `app/modules/competition/context.ts`;
- `app/routes/home.tsx`;
- rota pública de recurso/compatibilidade;
- `app/components/public-navigation.tsx`;
- `app/components/public-sports-core.tsx`;
- `app/app.css`;
- testes de contexto, navegação e renderização pública.

Aceite:

- edição abre em classificação;
- `/visao-geral` redireciona sem loop;
- seletor não é recortado em 390, 768 e 1440 px;
- ajuda da classificação possui contraste e foco visível;
- jogos aparecem em lista vertical, com nomes completos e sem número técnico;
- filtro não oferece `Ao vivo`;
- vitória/derrota são compreensíveis sem depender apenas de cor.

### UIUX-02 — Detalhe do jogo e boxscore

**Dependência:** UIUX-01 e integração da PR #49 antes do código final.

**Banco:** nenhuma migration prevista.
**Risco:** médio, por tocar a apresentação das duas fontes de boxscore.

Arquivos prováveis:

- `app/components/game-statistics.tsx`;
- novo helper puro de ordenação do boxscore;
- `app/modules/statistics/public-statistics.server.ts`;
- `app/modules/statistics/game-detail-domain.ts`;
- `app/app.css`;
- testes do domínio, loader e componente.

Aceite:

- boxscore aparece antes dos indicadores coletivos;
- período e final ocupam uma única tabela compacta;
- ordenação funciona por teclado e mouse nas duas equipes;
- titular usa `*`, DNP usa `NJ` em minutos e capitão usa `(C)`;
- totais são neutros e `+/-` de equipe não soma atletas;
- duas tabelas ficam lado a lado no desktop e empilhadas sem overflow global no celular;
- FIBA, súmula e Basketball Site respeitam suas capacidades sem zeros fabricados.

### UIUX-03 — Estatísticas e detalhe de equipes

**Dependência:** integração da PR #49 e UIUX-01.

**Banco:** evitar migration; usar views existentes sempre que possível.
**Risco:** médio/alto, por corrigir a projeção estatística FIBA e consolidar fontes.

Arquivos prováveis:

- `app/modules/statistics/public-sports.server.ts`;
- `app/modules/statistics/sports-domain.ts`;
- `app/components/public-sports-core.tsx`;
- `app/modules/competition/public-data.server.ts` ou DTO dedicado de equipe;
- `app/routes/public-detail.tsx` ou componente dedicado de perfil da equipe;
- testes de fonte, cobertura, modo e isolamento contextual.

Aceite:

- tabela usa `PTS`, `REB`, `AST`, `AP%`, `3P%`, `LL%` e `EF`;
- não há `/J` nos rótulos;
- alternância `Por jogo` / `Total` funciona e ordena pelo valor exibido;
- percentuais permanecem iguais nos dois modos;
- FIBA deixa de apresentar métricas disponíveis como `—`;
- fontes sem uma métrica continuam apresentando `—`, não zero;
- página da equipe reúne campanha, estatísticas, jogos, elenco e conquistas sem duplicar cálculo.

### UIUX-04 — Hub administrativo e busca

**Dependência:** pode avançar após UIUX-01, sem tocar arquivos em edição por outro pacote.

**Banco:** nenhum.
**Risco:** baixo.

Arquivos prováveis:

- `app/routes/admin.competitions.$competitionId.tsx`;
- `app/components/contextual-search.tsx`;
- testes de renderização, parâmetros e navegação;
- `app/app.css`.

Aceite:

- atalhos operacionais aparecem antes da lista de inscrições;
- estados administrativos são apresentados em português;
- busca local e global não mantêm estados visuais contraditórios;
- navegação por teclado, foco e URL permanecem coerentes.

## 4. Escopo negativo

Não faz parte destes pacotes:

- alterar parser FIBA ou Basketball Site;
- ampliar formatos de PDF;
- criar OCR;
- remover o estado `live` do banco;
- implementar atualização de placar em tempo real;
- alterar regras de classificação, desempate ou progressão;
- apagar dados de demonstração ou produção;
- modificar autenticação, MFA, RLS administrativa ou modelo de usuários;
- criar cache antes de nova medição;
- redesenhar a página de jogadores além da padronização de nomenclatura compartilhada;
- inferir capitão, titular, métricas ou resultados ausentes.

## 5. Estratégia de testes e gates

Durante cada pacote:

- Vitest focal para helpers, domínio, loaders e componentes alterados;
- testes de regressão para isolamento por edição, naipe e perfil de dados;
- pgTAP focal somente se UIUX-03 exigir nova view ou mudança SQL;
- QA de navegador em 390, 768 e 1440 px;
- teclado nas abas, seletor, disclosures, cabeçalhos ordenáveis e controles de modo;
- contraste para textos, placares e estados de vitória/derrota;
- verificar ausência de overflow global;
- conferir FIBA, súmula manual e Basketball Site quando disponível;
- gate consolidado antes do push: formatação, lint, typecheck, testes afetados, build e scan de segredos;
- preview/smoke antes de integrar cada pacote.

## 6. Ordem recomendada

1. Aguardar a validação e integração da PR #49.
2. Criar `feature/uiux-01-navigation-games` a partir da `main` atualizada.
3. Implementar e integrar UIUX-01.
4. Executar UIUX-02 em branch própria.
5. Executar UIUX-03 após estabilizar o contrato público das fontes.
6. Executar UIUX-04 por último ou em paralelo seguro, desde que não compartilhe arquivos com pacote ativo.
7. Publicar produção somente pela `main` protegida e após smoke público proporcional.

## 7. Próximo passo exato

Após a PR #49 ficar verde e ser integrada, criar `feature/uiux-01-navigation-games` a partir da `main`, atualizar `app/modules/competition/context.ts`, `app/routes/home.tsx` e `app/components/public-navigation.tsx` para tornar `Classificação` a entrada padrão e transformar o campeonato em seletor fora da trilha de abas. Validar redirecionamento de `/visao-geral`, foco por teclado e viewports 390/768/1440 antes de alterar a lista de jogos.
