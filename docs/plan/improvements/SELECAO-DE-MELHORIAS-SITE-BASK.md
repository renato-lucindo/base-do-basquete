# Seleção de melhorias para o Base do Basquete

Documento de triagem das funções, interfaces e experiências do `site-bask` que podem ser adaptadas para o `base-do-basquete`.

Repositórios analisados:

- Origem de referências: [renato-lucindo/site-bask](https://github.com/renato-lucindo/site-bask)
- Projeto de destino: [renato-lucindo/base-do-basquete](https://github.com/renato-lucindo/base-do-basquete)
- Data da análise: 24/08/2026

> Este documento é uma lista de decisões. Marque apenas uma opção de decisão em cada item e registre adaptações no campo **Observações**.

## Legenda de decisão

- [ ] **Fazer agora** — incluir no próximo ciclo de implementação.
- [ ] **Fazer depois** — manter no backlog.
- [ ] **Revisar** — discutir escopo ou prototipar antes de decidir.
- [ ] **Não fazer** — retirar do escopo.

## Resumo para triagem rápida

| ID | Prioridade sugerida | Melhoria | Decisão |
|---|---|---|---|
| PUB-01 | P0 | Classificação esportiva completa | [x] Agora [ ] Depois [ ] Revisar [ ] Não fazer |
| PUB-02 | P0 | Listagem informativa de jogos | [x] Agora [ ] Depois [ ] Revisar [ ] Não fazer |
| PUB-03 | P0 | Listagem estatística de equipes | [x] Agora [ ] Depois [ ] Revisar [ ] Não fazer |
| PUB-04 | P0 | Perfil completo do atleta | [x] Agora [ ] Depois [ ] Revisar [ ] Não fazer |
| PUB-05 | P0 | Página completa da equipe | [ ] Agora [x] Depois [ ] Revisar [ ] Não fazer |
| PUB-06 | P1 | Página ampliada da partida | [x] Agora [ ] Depois [ ] Revisar [ ] Não fazer |
| PUB-07 | P1 | Busca global contextual | [x] Agora [ ] Depois [ ] Revisar [ ] Não fazer |
| UX-01 | P1 | Ordenação e pesquisa nas tabelas | [x] Agora [ ] Depois [ ] Revisar [ ] Não fazer |
| UX-02 | P1 | Seleção e recolhimento de colunas | [x] Agora [ ] Depois [ ] Revisar [ ] Não fazer |
| UX-03 | P1 | Rolagem aprimorada para tabelas largas | [x] Agora [ ] Depois [ ] Revisar [ ] Não fazer |
| UX-04 | P2 | Comparador ampliado de atletas | [x] Agora [ ] Depois [ ] Revisar [ ] Não fazer |
| UX-05 | P2 | Navegação e breadcrumb aprimorados | [x] Agora [ ] Depois [ ] Revisar [ ] Não fazer |
| UX-06 | P2 | Metadados, erros e estados vazios específicos | [x] Agora [ ] Depois [ ] Revisar [ ] Não fazer |
| ADM-01 | P2 | Rascunho local e recuperação de formulários | [x] Agora [ ] Depois [ ] Revisar [ ] Não fazer |
| ADM-02 | P2 | Melhorias de revisão e validação administrativa | [x] Agora [ ] Depois [ ] Revisar [ ] Não fazer |

---

## PUB-01 — Classificação esportiva completa

**Prioridade sugerida:** P0  
**Valor:** alto  
**Referência:** página contextual de classificação do `site-bask`.

### Decisão

- [x] Fazer agora
- [ ] Fazer depois
- [ ] Revisar
- [ ] Não fazer

### Escopo selecionável

- [ ] Jogos disputados (J)
- [ ] Vitórias (V)
- [ ] Derrotas (D)
- [ ] Aproveitamento (%)
- [ ] Pontos pró (PP)
- [ ] Pontos contra (PC)
- [ ] Saldo de pontos (SLD)
- [ ] Posição numerada
- [ ] Link da equipe dentro da edição selecionada
- [ ] Critérios oficiais de desempate
- [ ] Legenda explicando siglas e desempates

### Diretriz técnica

Calcular a classificação no backend, em uma view/RPC ou serviço server-side testado. O React deve apenas apresentar o resultado. Não copiar o cálculo client-side do protótipo como fonte autoritativa.

### Critérios de aceite sugeridos

- [ ] Somente jogos finalizados afetam a classificação.
- [ ] Empates ou estados inválidos são tratados conforme a regra da competição.
- [x] Os critérios de desempate têm testes automatizados.
- [x] A classificação permanece isolada por edição e categoria.
- [x] A tabela funciona em telas pequenas e com teclado.

**Observações:**

> 

---

## PUB-02 — Listagem informativa de jogos

**Prioridade sugerida:** P0  
**Valor:** alto

### Decisão

- [x] Fazer agora
- [ ] Fazer depois
- [ ] Revisar
- [ ] Não fazer

### Escopo selecionável

- [ ] Data e horário
- [ ] Número do jogo
- [ ] Mandante e visitante
- [ ] Siglas das equipes
- [ ] Placar quando disponível
- [ ] Status: agendado, ao vivo ou finalizado
- [ ] Local da partida
- [ ] Link para detalhes
- [ ] Ordenação cronológica
- [ ] Separação entre próximos e encerrados
- [ ] Filtro por equipe
- [ ] Filtro por período/data

### Critérios de aceite sugeridos

- [x] Jogos agendados não aparecem como placar final `0 × 0`.
- [x] Horários usam `America/Sao_Paulo`.
- [?] A listagem preserva o contexto da edição.
- [ ] Estados sem horário ou local possuem textos adequados.

**Observações:**

> Não entendi o terceiro critério.

---

## PUB-03 — Listagem estatística de equipes

**Prioridade sugerida:** P0  
**Valor:** alto

### Decisão

- [x] Fazer agora
- [ ] Fazer depois
- [ ] Revisar
- [ ] Não fazer

### Escopo selecionável

- [ ] Nome e sigla
- [ ] Jogos, vitórias e derrotas
- [ ] Pontos por jogo
- [ ] Rebotes por jogo
- [ ] Assistências por jogo
- [ ] Aproveitamentos de arremesso
- [ ] Eficiência
- [ ] Estatísticas avançadas existentes no modelo
- [ ] Link para a página da equipe

### Diretriz técnica

Derivar os agregados dos read models autoritativos. Métricas que ainda não existirem no modelo canônico devem ser tratadas como uma ampliação separada do banco, não como cálculo improvisado na interface.

**Observações:**

> 

---

## PUB-04 — Perfil completo do atleta

**Prioridade sugerida:** P0  
**Valor:** alto  
**Referência:** perfil de jogador do `site-bask`.

### Decisão

- [x] Fazer agora
- [ ] Fazer depois
- [ ] Revisar
- [ ] Não fazer

### Escopo selecionável

- [ ] Nome completo
- [ ] Apelido
- [ ] Equipe atual na edição
- [ ] Número da camisa na edição
- [ ] Camisa histórica mais utilizada
- [ ] Altura
- [ ] Data de nascimento/idade
- [ ] Posição
- [ ] Resumo da temporada atual
- [ ] Resumo da carreira
- [ ] Totais e médias
- [ ] Estatísticas separadas por competição
- [ ] Conquistas confirmadas
- [ ] Histórico de equipes
- [ ] Lista de jogos do atleta

### Critérios de aceite sugeridos

- [x] Dados pessoais só aparecem quando estiverem marcados como públicos.
- [?] Estatísticas são isoladas por edição.
- [x] Conquistas continuam derivadas de resultados confirmados.
- [x] Atleta sem jogos possui um estado vazio, sem números enganosos.

**Observações:**

> Iremos alinhar esse ponto ainda
>
> Navegação do perfil definida como âncoras com aparência de abas, nesta ordem: `Resumo`, `Estatísticas`, `Conquistas e honrarias`, `Jogos` e `Histórico`. Todas as seções permanecem na mesma página.
>
> Revisão concluída. Implementar agora conforme o arquivo `TABELAS-PERFIL-JOGADORES.md`.

---

## PUB-05 — Página completa da equipe

**Prioridade sugerida:** P0  
**Valor:** alto  
**Referência:** página de equipe do `site-bask`.

### Decisão

- [ ] Fazer agora
- [x] Fazer depois
- [ ] Revisar
- [ ] Não fazer

### Escopo selecionável

- [ ] Identificação e sigla
- [ ] Resumo de jogos, vitórias e derrotas
- [ ] Elenco da edição
- [ ] Camisas dos atletas
- [ ] Totais dos atletas
- [ ] Médias dos atletas
- [ ] Médias da equipe
- [ ] Estatísticas avançadas da equipe
- [ ] Jogos da equipe
- [ ] Conquistas confirmadas
- [ ] Histórico por edição

### Critérios de aceite sugeridos

- [x] O elenco exibido pertence à edição selecionada.
- [x] Transferências ou camisas históricas não alteram retroativamente outras edições.
- [x] Estatísticas da equipe reconciliam com os jogos finalizados.

**Observações:**

> 

---

## PUB-06 — Página ampliada da partida

**Prioridade sugerida:** P1  
**Valor:** alto

### Decisão

- [x] Fazer agora
- [ ] Fazer depois
- [ ] Revisar
- [ ] Não fazer

### Escopo de baixo risco, suportado pelos dados atuais

- [x] Linha de totais por equipe
- [x] Convertidos/tentados de quadra
- [x] Convertidos/tentados de três pontos
- [x] Convertidos/tentados de lance livre
- [x] Rebotes ofensivos e defensivos
- [x] Roubos, tocos e erros
- [x] Eficiência
- [x] `+/-`
- [x] Destaque de titulares
- [x] Indicação de atleta que não jogou
- [x] Links para atleta e equipe

### Escopo que pode exigir ampliação do modelo

- [x] Pontos de erros
- [x] Pontos no garrafão
- [x] Pontos de segunda chance
- [x] Pontos de contra-ataque
- [x] Pontos do banco
- [x] Maior vantagem
- [x] Maior sequência
- [x] Trocas de liderança
- [x] Tempo na liderança
- [x] Pontos por posse

### Critérios de aceite sugeridos

- [x] Totais visuais reconciliam com os dados persistidos.
- [x] A soma dos pontos dos atletas é validada contra o placar quando aplicável.
- [x] Categorias sem estatísticas avançadas recebem visual simplificado.
- [?] A tabela possui caption, cabeçalhos semânticos e navegação por teclado.

**Observações:**

> Escolhida a opção C: conjunto completo, organizado em resumo essencial e seção recolhível de estatísticas adicionais para funcionar bem no celular.

---

## PUB-07 — Busca global contextual

**Prioridade sugerida:** P1  
**Valor:** alto  
**Referência:** `GlobalSearch` do `site-bask`.

### Decisão

- [x] Fazer agora
- [ ] Fazer depois
- [ ] Revisar
- [ ] Não fazer

### Escopo selecionável

- [ ] Busca de atletas
- [ ] Busca de equipes
- [ ] Busca de competições
- [ ] Busca de categorias e anos
- [ ] Resultados agrupados por tipo
- [ ] Busca sem diferenciar acentos
- [ ] Busca por substring
- [ ] Atalho de teclado
- [ ] Preservação da edição atual
- [ ] Busca global fora de uma edição

### Diretriz técnica

Criar endpoint ou loader server-side com debounce, paginação/limite e resposta mínima. Não carregar todos os atletas e equipes no navegador para realizar a busca.

### Critérios de aceite sugeridos

- [x] A busca não expõe registros privados.
- [x] Os resultados são limitados e rápidos.
- [x] A seleção direciona para URL contextual correta.
- [x] O controle é operável por teclado e anunciado por leitor de tela.

**Observações:**
Tem que conseguir buscar pelo apeligo dos atletas e sigla das equipes também
> 

---

## UX-01 — Ordenação e pesquisa nas tabelas

**Prioridade sugerida:** P1

### Decisão

- [x] Fazer agora
- [ ] Fazer depois
- [ ] Revisar
- [ ] Não fazer

### Escopo selecionável

- [ ] Ordenação por nome
- [ ] Ordenação por equipe
- [ ] Ordenação por jogos
- [ ] Ordenação por todas as métricas numéricas
- [ ] Indicação de direção da ordenação
- [ ] Pesquisa por atleta
- [ ] Pesquisa por equipe
- [ ] Persistência da ordenação na URL
- [ ] Persistência dos filtros na URL

### Diretriz de acessibilidade

Usar um botão dentro de cada cabeçalho ordenável e atualizar `aria-sort`. Não copiar cabeçalhos que dependam somente de `onClick` no elemento `<th>`.

**Observações:**

> 

---

## UX-02 — Seleção e recolhimento de colunas

**Prioridade sugerida:** P1

### Decisão

- [x] Fazer agora
- [ ] Fazer depois
- [ ] Revisar
- [ ] Não fazer

### Escopo selecionável

- [ ] Mostrar/ocultar colunas
- [ ] Selecionar todas
- [ ] Limpar seleção
- [ ] Presets “Resumo”, “Arremessos” e “Completo”
- [ ] Recolher/expandir seções
- [ ] Persistir preferências no navegador
- [ ] Manter colunas essenciais sempre visíveis

### Observação

O comportamento pode ser inspirado no `ColumnFilter` do `site-bask`, adaptado ao design e à acessibilidade do projeto atual.

**Observações:**

> 

---

## UX-03 — Rolagem aprimorada para tabelas largas

**Prioridade sugerida:** P1

### Decisão

- [x] Fazer agora
- [ ] Fazer depois
- [ ] Revisar
- [ ] Não fazer

### Escopo selecionável

- [x] Primeira coluna fixa
- [x] Cabeçalho fixo
- [x] Barra de rolagem também no topo
- [x] Sombras indicando conteúdo fora da tela
- [x] Rolagem por toque
- [x] Versão resumida para celular

### Observação

O `base-do-basquete` já fixa a primeira coluna. O ganho principal do `ScrollableTable` do `site-bask` é a barra horizontal superior sincronizada.

**Observações:**

> 

---

## UX-04 — Comparador ampliado de atletas

**Prioridade sugerida:** P2

### Decisão

- [x] Fazer agora
- [ ] Fazer depois
- [ ] Revisar
- [ ] Não fazer

### Escopo selecionável

- [ ] Seleção pesquisável de atletas
- [ ] Comparação de totais
- [ ] Comparação de médias
- [ ] MIN, PTS, REB, RO, RD e AST
- [ ] Roubos, tocos, erros e faltas
- [ ] Aproveitamentos
- [ ] Eficiência
- [ ] `+/-`
- [ ] Links para os perfis
- [ ] Compartilhamento da comparação por URL

### Diretriz de UX

Manter textos como “Melhor”, “Menor” e “Empate”. Cores e setas devem ser complementares, nunca a única indicação do resultado.

**Observações:**

> Quero que a única indicação seja a cor. Verde para melhor, vermelho para pior e cor normal da fonte em caso de empate
>
> LEMBRETE: decisão adiada sobre incluir ou não texto invisível para leitores de tela. Revisar antes de implementar o comparador.

---

## UX-05 — Navegação e breadcrumb aprimorados

**Prioridade sugerida:** P2

### Decisão

- [x] Fazer agora
- [ ] Fazer depois
- [ ] Revisar
- [ ] Não fazer

### Escopo selecionável

- [ ] Melhor hierarquia visual do breadcrumb
- [ ] Troca rápida de ano
- [ ] Troca rápida de competição
- [ ] Troca rápida de categoria
- [ ] Agrupamento de categorias adulto/base
- [ ] Preservação do recurso atual ao trocar edição
- [ ] Menu compacto para celular

### Diretriz técnica

Preservar a principal vantagem do `base-do-basquete`: opções provenientes do banco e preferência contextual em cookie. Não portar arrays fixos de anos, competições ou categorias.

**Observações:**

> 

---

## UX-06 — Metadados, erros e estados vazios específicos

**Prioridade sugerida:** P2

### Decisão

- [x] Fazer agora
- [ ] Fazer depois
- [ ] Revisar
- [ ] Não fazer

### Escopo selecionável

- [ ] Títulos de página específicos
- [ ] Descrições específicas para SEO
- [ ] Página 404 amigável
- [ ] Tela de erro com tentativa novamente
- [ ] Estado vazio de classificação
- [ ] Estado vazio de jogos
- [ ] Estado vazio de atleta/equipe sem estatísticas
- [ ] Skeleton ou indicador de carregamento

**Observações:**

> 

---

## ADM-01 — Rascunho local e recuperação de formulários

**Prioridade sugerida:** P2  
**Referência:** fluxo de inscrição de equipes do `site-bask`.

### Decisão

- [x] Fazer agora
- [ ] Fazer depois
- [ ] Revisar
- [ ] Não fazer

### Escopo selecionável

- [x] Rascunho de edição de elenco
- [x] Rascunho de súmula manual
- [x] Rascunho da revisão de importação
- [x] Aviso de rascunho restaurado
- [x] Opção de descartar rascunho
- [x] Expiração automática
- [x] Aviso antes de sair com alterações pendentes

### Diretriz de segurança

O rascunho local é apenas conveniência. MFA/AAL2, CSRF, idempotência, autorização e validação final continuam obrigatórios no servidor. Evitar guardar PDF, token, sessão ou informação sensível em `localStorage`.

**Observações:**

> Escolhida a opção C: rascunhos para elenco, súmula e revisão da importação. Não armazenar localmente o PDF, tokens ou dados de sessão.

---

## ADM-02 — Melhorias de revisão e validação administrativa

**Prioridade sugerida:** P2

### Decisão

- [x] Fazer agora
- [ ] Fazer depois
- [ ] Revisar
- [ ] Não fazer

### Escopo selecionável

- [ ] Erros exibidos junto ao campo correspondente
- [ ] Resumo fixo do placar
- [ ] Contagem de vínculos pendentes
- [ ] Busca de atleta no elenco
- [ ] Destaque de camisa duplicada
- [ ] Destaque de atleta inscrito por outra equipe
- [ ] Revisão final antes de confirmar
- [ ] Foco automático no primeiro erro
- [ ] Confirmação explícita de ação irreversível

### Diretriz técnica

Manter os fluxos atuais do `base-do-basquete` para súmula transacional, importação FIBA/Genius, MFA, armazenamento privado e auditoria. Adaptar somente a ergonomia da interface.

**Observações:**

> 

---

## Funcionalidades já cobertas — confirmar se precisam apenas de polimento

Marque quando desejar uma revisão visual ou funcional, sem reconstrução completa.

- [ ] Totais versus médias por jogo
- [ ] Filtros estatísticos
- [ ] Comparação básica de atletas
- [ ] URLs isoladas por edição, série e categoria
- [ ] Preferência da edição em cookie
- [ ] Súmula manual transacional
- [ ] Validação de prorrogação e placar
- [ ] Importação segura de boxscore FIBA/Genius
- [ ] Prevenção de importação duplicada
- [ ] Gestão de inscrições e elencos
- [ ] Histórico de camisas
- [ ] Colocações e conquistas confirmadas
- [ ] MFA/AAL2 para administração
- [ ] RLS, auditoria, CSRF e idempotência

**Observações sobre funcionalidades existentes:**

> 

---

## Itens que não devem ser copiados diretamente

Desmarque somente se houver uma decisão consciente de arquitetura para reavaliar o item.

- [x] Não usar acesso direto do navegador às tabelas do Supabase.
- [x] Não realizar escritas administrativas diretamente no cliente.
- [x] Não usar listas fixas de anos, competições ou categorias.
- [x] Não mover o parser seguro de PDF para o navegador.
- [x] Não trazer rotas provisórias ou de laboratório para produção.
- [x] Não adicionar toda a biblioteca Shadcn/Radix apenas para copiar o visual.
- [x] Não tornar cálculos client-side a fonte autoritativa.
- [x] Não substituir os controles atuais de MFA, RLS, CSRF ou idempotência.

**Exceções ou observações:**

> 

---

## Ordem de execução escolhida

Preencha somente depois da triagem.

1. 
2. 
3. 
4. 
5. 
6. 

## Restrições e preferências gerais

- [ ] Manter o visual atual do `base-do-basquete`
- [x] Aproximar o visual do `site-bask`
- [x] Criar uma nova direção visual
- [ ] Priorizar desktop
- [x] Priorizar celular
- [ ] Priorizar acessibilidade
- [ ] Priorizar velocidade de entrega
- [x] Priorizar desempenho
- [x] Exigir testes automatizados para todos os itens
- [ ] Exigir protótipo visual antes da implementação

**Preferências adicionais:**

> Criar uma nova direção visual inspirada no `site-bask`, sem copiá-lo integralmente.

## Decisão final da rodada

**Itens aprovados:**

> Todos os itens marcados como `Fazer agora`, incluindo seus subitens, observadas as decisões posteriores registradas nas observações e no arquivo `TABELAS-PERFIL-JOGADORES.md`.

**Itens rejeitados:**

> Nenhum nesta rodada. `PUB-05` permanece adiado e não faz parte da implementação atual.

**Itens que precisam de discussão:**

> Somente a decisão visual/acessível do comparador (`UX-04`) sobre texto invisível. Não bloquear as demais entregas por esse ponto.

**Observações finais:**

> Discussão concluída, exceto pelo lembrete específico de `UX-04` registrado na própria seção.

