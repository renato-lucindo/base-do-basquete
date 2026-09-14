# Plano de implementação e divisão das PRs

## 1. Objetivo

Implementar, em partes revisáveis e seguras, as melhorias aprovadas para o repositório `renato-lucindo/base-do-basquete`.

Este documento substitui somente a instrução de abrir um único pull request presente em `PROMPT-IMPLEMENTACAO-MELHORIAS.md`. Em seu lugar, o trabalho será dividido em PRs sequenciais. Todas as demais regras, decisões funcionais e garantias de segurança dos documentos de requisitos continuam obrigatórias.

Documentos normativos:

1. `SELECAO-DE-MELHORIAS-SITE-BASK.md` — define o que foi aprovado, adiado e rejeitado.
2. `TABELAS-PERFIL-JOGADORES.md` — detalha o modelo e as decisões do perfil do atleta.
3. `PROMPT-IMPLEMENTACAO-MELHORIAS.md` — define arquitetura, segurança, testes e forma de entrega, exceto pela exigência de PR único substituída por este plano.

Em caso de aparente conflito, prevalece a decisão mais específica e mais recente. Nenhuma divergência que afete banco, privacidade, segurança ou integridade histórica deve ser resolvida silenciosamente.

## 2. Resultado esperado

O trabalho será entregue em sete PRs, nesta ordem:

| PR | Pacote | Dependência |
|---|---|---|
| 1 | Fundação de dados, privacidade e read models | `main` atualizada |
| 2 | Infraestrutura compartilhada de tabelas e estados | PR 1 apenas quando utilizar seus tipos ou contratos |
| 3 | Jogos, classificação e estatísticas de equipes | PRs 1 e 2 |
| 4 | Perfil completo do atleta | PRs 1 e 2 |
| 5 | Página ampliada da partida | PRs 1 e 2; PR 3 quando reutilizar a navegação de jogos |
| 6 | Busca, navegação e comparador | PRs 3, 4 e 5 |
| 7 | Administração, revisão transversal e fechamento | PRs anteriores |

`PUB-05 — Página completa da equipe` permanece adiado e não faz parte de nenhuma PR deste ciclo.

## 3. Estratégia de branches e PRs

### 3.1 Preparação

Antes da primeira alteração:

1. Inspecionar e atualizar a referência local da `main`.
2. Executar o gate de testes existente no repositório.
3. Registrar separadamente falhas preexistentes, sem mascará-las ou atribuí-las às novas mudanças.
4. Mapear migrations, views, loaders, rotas, componentes e testes que serão afetados.
5. Confirmar os comandos oficiais de lint, typecheck, build, testes de banco e testes completos.

### 3.2 PRs empilhadas

Enquanto uma PR dependente ainda não tiver sido integrada:

- a branch seguinte pode partir da branch anterior;
- a PR seguinte deve apontar temporariamente para a branch da qual depende, mostrando somente seu próprio diff;
- depois do merge da dependência, a branch deve ser atualizada e a PR deve ser redirecionada para `main`;
- conflitos devem ser resolvidos preservando migrations já integradas e mudanças legítimas feitas na `main`.

Sugestão de branches:

```text
feature/01-player-data-foundation
feature/02-table-infrastructure
feature/03-public-sports-core
feature/04-player-profile
feature/05-game-details
feature/06-search-navigation-comparison
feature/07-admin-and-hardening
```

Não fazer merge nem deploy de produção sem autorização explícita. Cada PR deve permanecer em modo draft enquanto seus critérios de aceite não estiverem completos.

## 4. Regras comuns a todas as PRs

- Preservar o monólito modular, React Router, Cloudflare Workers e Supabase.
- Manter banco, backend e read models como fontes autoritativas.
- Não criar acesso ou escrita direta do navegador nas tabelas do Supabase.
- Preservar MFA/AAL2, RLS, CSRF, idempotência, auditoria e armazenamento privado.
- Não mover o parser seguro de PDF para o navegador.
- Não usar listas fixas de anos, competições ou categorias.
- Não renomear tabelas ou views existentes em produção.
- Fazer migrations compatíveis com dados existentes e instalações desde zero.
- Evitar dependências novas sem justificativa objetiva registrada na PR.
- Priorizar celular, desempenho e acessibilidade estrutural.
- Adotar uma direção visual própria, inspirada no `site-bask`, sem copiá-lo integralmente.
- Implementar estados de carregamento, vazio e erro junto de cada funcionalidade, e não somente ao final.
- Adicionar testes automatizados proporcionais ao risco de cada mudança.
- Não misturar refatorações sem relação com o pacote da PR.

## 5. PR 1 — Fundação de dados, privacidade e read models

### Objetivo

Criar os contratos autoritativos necessários para o perfil, a busca e as estatísticas, garantindo migração segura dos dados existentes.

### Escopo

- Adicionar `nickname` a `players`, público, pesquisável e não único.
- Criar `player_profiles` em relação 1:1 com `players`.
- Adicionar a `player_profiles`: `bio`, `height_cm`, `weight_kg`, `main_position`, `hand`, `home_city` e `home_state`.
- Criar `player_private` para a data completa de nascimento e o único `federation_no` opcional do atleta.
- Migrar o `birth_date` existente sem perda de dados.
- Tornar público somente o ano de nascimento; nunca expor diretamente a data completa.
- Criar uma fachada pública segura que não contenha campos privados.
- Adicionar `position` a `roster_entries` como posição específica naquela edição.
- Não criar campo genérico de função/categoria no elenco.
- Criar `player_honors`, separado das conquistas coletivas derivadas, com publicação limitada a registros confirmados.
- Não criar `player_teams`; manter o histórico derivado de `roster_entries` e `team_registrations`.
- Atualizar `competition_player_statistics` sem renomeá-la, incluindo faltas, equipe, sigla, camisa e titularidades.
- Agregar faltas, estatísticas e titularidades separadamente antes dos joins, evitando multiplicação de totais.
- Atualizar RLS, grants, tipos gerados, validações, queries e contratos necessários.

### Fora do escopo

- Interface completa do perfil.
- Busca global visível.
- Alterações de apresentação das páginas públicas.
- Métricas avançadas específicas da partida.

### Gate de conclusão

- Migration funciona sobre uma base com dados existentes e em uma instalação desde zero.
- Migração de nascimento possui teste de preservação de dados.
- Consultas públicas não conseguem retornar data completa de nascimento nem `federation_no`.
- RLS e grants possuem testes positivos e negativos.
- Totais da view atualizada não são multiplicados pelos novos joins.
- Tipos gerados e testes TypeScript estão atualizados.
- Lint, typecheck, testes de banco e build passam.

## 6. PR 2 — Infraestrutura compartilhada de tabelas e estados

### Objetivo

Criar componentes reutilizáveis antes de construir as novas páginas estatísticas.

### Escopo

- UX-01: ordenação e pesquisa nas tabelas.
- UX-02: seleção, presets e recolhimento de colunas.
- UX-03: primeira coluna e cabeçalho fixos, barra superior sincronizada, sombras, toque e versão resumida para celular.
- Cabeçalhos ordenáveis com botão e atualização de `aria-sort`.
- Persistência de ordenação e filtros na URL quando aplicável.
- Persistência segura de preferências visuais no navegador.
- Colunas essenciais permanentemente visíveis.
- Primitivos reutilizáveis de carregamento, erro e estado vazio ligados a UX-06.

### Fora do escopo

- Regras esportivas de classificação.
- Queries autoritativas de estatísticas.
- Conteúdo completo das páginas públicas.

### Gate de conclusão

- Componentes funcionam com teclado e leitor de tela.
- Rolagem superior e inferior permanece sincronizada.
- Primeira coluna, cabeçalho fixo e sombras não ocultam conteúdo.
- Presets e preferências sobrevivem à recarga quando previsto.
- Layout é verificado em larguras de celular e desktop.
- Testes unitários e de interação cobrem ordenação, colunas e rolagem.
- Lint, typecheck e build passam.

## 7. PR 3 — Jogos, classificação e estatísticas de equipes

### Objetivo

Entregar o núcleo público P0 na ordem das dependências esportivas.

### Ordem interna

1. PUB-02 — Listagem informativa de jogos.
2. PUB-01 — Classificação esportiva completa.
3. PUB-03 — Listagem estatística de equipes.

### Escopo

- Exibir jogos agendados, ao vivo e finalizados sem representar jogo agendado como placar final `0 × 0`.
- Usar o fuso `America/Sao_Paulo`.
- Preservar ano, competição, série e categoria durante filtros, navegação para o jogo e retorno à listagem.
- Incluir filtros, ordenação cronológica e separação entre próximos e encerrados.
- Calcular classificação no backend, view, RPC ou serviço server-side testado.
- Considerar somente jogos finalizados na classificação.
- Implementar critérios oficiais de desempate e sua legenda.
- Isolar classificação e estatísticas por edição e categoria.
- Derivar estatísticas de equipes de read models autoritativos.
- Não improvisar métricas ausentes no cliente.
- Implementar títulos, descrições, carregamento, erros e estados vazios específicos das páginas.

### Gate de conclusão

- Desempates possuem testes automatizados para todas as regras adotadas.
- Jogos não finalizados não afetam classificação nem agregados finais.
- Horários são testados no fuso definido.
- Links e filtros mantêm o contexto da edição.
- Agregados das equipes reconciliam com os jogos finalizados.
- Tabelas passam pelos testes de teclado e responsividade da PR 2.
- Lint, typecheck, testes relevantes e build passam.

## 8. PR 4 — Perfil completo do atleta

### Objetivo

Entregar PUB-04 usando exclusivamente a fachada pública e os read models estabilizados na PR 1.

### Escopo

- Cabeçalho público com os dados aprovados e tratamento explícito de ausências.
- Resumo da edição atual e da carreira.
- Totais e médias, separados corretamente por competição e edição.
- Conquistas coletivas confirmadas e honrarias individuais confirmadas.
- Histórico de equipes derivado do elenco, sem criar `player_teams`.
- Histórico de camisas e lista de jogos.
- Estado vazio para atleta sem partidas, sem apresentar zeros enganosos.
- Navegação por links/âncoras, na mesma página e nesta ordem:
  1. `Resumo` → `#resumo`
  2. `Estatísticas` → `#estatisticas`
  3. `Conquistas e honrarias` → `#conquistas-honrarias`
  4. `Jogos` → `#jogos`
  5. `Histórico` → `#historico`
- Navegação fixa durante a rolagem, seção atual indicada, suporte a hash, voltar/avançar, teclado e rolagem horizontal no celular.
- Uso de `scroll-margin-top` ou solução equivalente.
- Não usar semântica `tablist`, pois as seções continuam simultaneamente presentes.

### Gate de conclusão

- Nenhuma resposta pública contém campos de `player_private`.
- Acesso direto por cada hash posiciona corretamente a seção.
- Voltar e avançar do navegador preservam a navegação por âncoras.
- Estatísticas permanecem isoladas por edição.
- Conquistas e honrarias não confirmadas não são exibidas.
- Perfil sem jogos possui estado vazio adequado.
- Testes cobrem privacidade, dados, navegação, teclado e celular.
- Lint, typecheck, testes relevantes e build passam.

## 9. PR 5 — Página ampliada da partida

### Objetivo

Entregar PUB-06 sem misturar valores derivados da interface com dados autoritativos.

### Parte A — Dados já suportados

- Linha de totais por equipe.
- Arremessos convertidos e tentados.
- Rebotes ofensivos e defensivos.
- Roubos, tocos, erros, eficiência e `+/-`.
- Destaque de titulares e indicação de atleta que não jogou.
- Links para atletas e equipes.

### Parte B — Ampliação do modelo

- Pontos de erros, garrafão, segunda chance, contra-ataque e banco no resumo essencial.
- Maior vantagem, maior sequência, trocas de liderança, empates, tempo na liderança e pontos por posse em “Mais estatísticas”.
- Visual simplificado para categorias sem estatísticas avançadas.

As partes A e B devem ser commits separados, mesmo permanecendo na mesma PR.

### Gate de conclusão

- Totais visuais reconciliam com os dados persistidos.
- Soma dos pontos dos atletas é validada contra o placar quando aplicável.
- Métricas avançadas têm fonte e fórmula documentadas.
- Valores indisponíveis não são apresentados como zero confirmado.
- Tabelas possuem `caption`, cabeçalhos semânticos e operação por teclado.
- Resumo e seção recolhível funcionam no celular.
- Migrations adicionais, quando necessárias, passam desde zero e sobre dados existentes.
- Lint, typecheck, testes relevantes e build passam.

## 10. PR 6 — Busca, navegação e comparador

### Objetivo

Conectar as páginas já entregues e ampliar a descoberta de conteúdo.

### Escopo

- PUB-07: busca contextual server-side com debounce, limite, resposta mínima e controle de custo.
- Buscar atletas por nome completo e apelido.
- Buscar equipes por nome e sigla.
- Buscar competições, categorias e anos.
- Normalizar acentos e aceitar substring.
- Agrupar resultados por tipo e preservar o contexto da edição.
- Garantir operação por teclado e anúncio adequado para leitor de tela.
- UX-05: breadcrumb, troca rápida de ano, competição e categoria, agrupamento adulto/base e menu compacto.
- Obter opções do banco; não introduzir listas fixas.
- UX-04: seleção pesquisável, totais, médias, métricas aprovadas, links e compartilhamento por URL.
- Manter “melhor”, “pior” e “empate” visualmente representados conforme a decisão registrada, sem remover silenciosamente a informação necessária à tecnologia assistiva.

### Pendência explícita do comparador

A decisão sobre texto invisível para leitores de tela continua pendente. Ela não deve impedir a implementação funcional do comparador. Enquanto não houver decisão final, preservar o comportamento acessível existente e registrar a pendência na descrição da PR.

### Gate de conclusão

- Busca não expõe registros privados ou não publicáveis.
- Resultados são limitados e mensurados quanto a custo e tempo de resposta.
- URLs selecionadas preservam a edição correta.
- Busca e comparador funcionam integralmente por teclado.
- Comparações compartilhadas podem ser restauradas pela URL.
- Navegação contextual não direciona silenciosamente para outra edição.
- Testes cobrem acentos, substring, apelidos, siglas, limites e registros privados.
- Lint, typecheck, testes relevantes e build passam.

## 11. PR 7 — Administração, revisão transversal e fechamento

### Objetivo

Melhorar os fluxos administrativos sem enfraquecer as garantias atuais e executar a revisão final do conjunto.

### Ordem interna

1. ADM-02 — Melhorias de revisão e validação administrativa.
2. ADM-01 — Rascunho local e recuperação de formulários.
3. Revisão transversal de UX-06, segurança, responsividade e desempenho.

### Escopo de validação administrativa

- Erros próximos aos campos e foco no primeiro erro.
- Resumo fixo do placar e contagem de vínculos pendentes.
- Busca de atleta no elenco.
- Destaques para camisa duplicada e atleta inscrito por outra equipe.
- Revisão final antes da confirmação.
- Confirmação explícita de ação irreversível.

### Escopo de rascunhos

- Edição de elenco.
- Súmula manual.
- Revisão da importação.
- Aviso de restauração, descarte e expiração automática.
- Aviso antes de sair com alterações pendentes.
- Reutilização do rascunho persistido no servidor quando ele já existir.
- Proibição de armazenar localmente PDF, token, sessão, segredo ou credencial.

### Revisão transversal

- Completar metadados, 404, erros recuperáveis, estados vazios e carregamento.
- Verificar celular, teclado, leitor de tela e contraste.
- Verificar desempenho das queries e tamanho das respostas.
- Revisar autorização, MFA/AAL2, RLS, CSRF, idempotência e auditoria.
- Executar migrations desde zero, testes de banco, lint, typecheck, build e o gate completo do repositório.

### Gate de conclusão

- Rascunhos são associados ao formulário e contexto corretos e possuem expiração testada.
- Dados proibidos nunca são gravados no armazenamento local.
- Restauração e descarte não criam duas fontes conflitantes.
- Validação final continua obrigatória no servidor.
- Ações administrativas preservam MFA/AAL2, CSRF, idempotência e auditoria.
- Revisão responsiva e de segurança não deixa bloqueadores conhecidos.
- Gate completo do repositório passa.

## 12. Conteúdo obrigatório de cada PR

Cada descrição de PR deve conter:

```markdown
## Objetivo

## Escopo implementado

## Fora do escopo

## Dependências

## Migrations e compatibilidade

## Segurança e privacidade

## Testes executados

## Evidências visuais ou funcionais

## Riscos e limitações

## Pendências para a próxima PR

## Checklist de revisão
```

Quando houver migrations, informar a ordem, estratégia de backfill, compatibilidade com rollback lógico e efeito sobre dados existentes. Quando houver interface, anexar evidências em celular e desktop. Não incluir segredos, dados pessoais reais ou tokens nas evidências.

## 13. Política de revisão e merge

Uma PR só pode sair de draft quando:

- seu escopo estiver completo;
- todos os gates daquele pacote estiverem atendidos;
- migrations e contratos estiverem documentados;
- testes relevantes passarem;
- riscos e pendências estiverem explicitamente registrados;
- não houver alteração fora do escopo sem justificativa.

Uma PR só pode ser integrada quando:

- suas dependências anteriores estiverem integradas ou houver autorização explícita para outro fluxo;
- a branch estiver atualizada em relação à base definitiva;
- não houver falha de segurança, privacidade ou integridade de dados;
- houver aprovação humana;
- não houver solicitação de deploy ou merge automático pendente.

Falha não relacionada e comprovadamente preexistente deve ser documentada. Ela não deve ser ocultada, desativada ou contornada apenas para deixar o pipeline verde.

## 14. Critério de encerramento do ciclo

O ciclo estará concluído somente quando as sete PRs tiverem sido revisadas e integradas, o gate completo passar sobre a `main` resultante e o handoff final registrar:

- funcionalidades entregues por PR;
- migrations aplicadas;
- testes e evidências;
- riscos remanescentes;
- decisão ainda pendente do comparador, caso não tenha sido resolvida;
- confirmação de que PUB-05 permaneceu fora do escopo;
- confirmação de que não houve merge adicional nem deploy de produção sem autorização.

