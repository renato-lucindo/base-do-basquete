# Plano — Súmula manual v2 com lançamento rápido e regras FIBA 2024

## Resumo

Implementar a evolução da súmula manual em uma **PR isolada**, em branch/worktree próprios, sem reaproveitar a branch atualmente modificada. A nova versão será voltada à transcrição pós-jogo em desktop, com criação do jogo dentro do próprio fluxo, digitação rápida por teclado, faltas FIBA 2024 corretamente modeladas, capitão/titulares/comissão técnica, oficiais da partida e revisão auditável de súmulas já salvas.

A súmula continuará independente do fluxo de boxscore. O modelo de pontuação permanecerá agregado por atleta/período; o histórico recente de digitação servirá apenas para operação/undo.

## Mudanças principais

- Criar o jogo somente na confirmação final da súmula, em uma única transação:
  - obrigatórios: mandante, visitante e data;
  - opcionais: horário, local, número do jogo, fase/rodada, observações;
  - utilizar apenas inscrições/equipes válidas da competição;
  - impedir jogo órfão se a gravação da súmula falhar;
  - manter chave de idempotência.
- Oficiais opcionais, exatamente nestes campos:
  - Árbitro;
  - Fiscal 1;
  - Fiscal 2;
  - Apontador;
  - Cronometrista;
  - Operador de 24 Segundos.
- Registrar por equipe:
  - até 12 atletas já registrados;
  - camisa utilizada no jogo;
  - titulares;
  - capitão;
  - técnico;
  - primeiro assistente opcional.
- Para ausência de técnico cadastrado, incluir **“Usar capitão como técnico”**:
  - copia o nome do capitão para o campo;
  - registra internamente que veio de `captain_placeholder`;
  - não transforma o atleta em entidade de técnico;
  - acompanha troca de capitão enquanto a vinculação estiver ativa;
  - edição manual do campo desfaz essa vinculação.
- Continuar permitindo troca de atleta somente por outro já registrado/disponível e alteração da camisa. Não criar atleta pela súmula.

### Lançamento rápido

- Usuário escolhe **período + equipe** uma vez e pode trabalhar somente com teclado.
- Pontuação mantém o fluxo de dois passos:
  - `12 Enter 2 Enter`
  - `87 Enter 1 Enter`
  - `13 Enter 3 Enter`
- Estados explícitos: aguardando camisa → aguardando valor.
- Valores de pontuação válidos: `1`, `2` e `3`.
- `00` continua sendo preservado como string.
- Após cada lançamento, foco volta automaticamente para a próxima camisa.
- `Esc` cancela entrada parcial.
- `Ctrl+Z` desfaz o último lançamento da sessão de digitação.
- Mostrar uma lista curta dos últimos lançamentos para conferência; ela não será fonte autoritativa dos dados.

Para faltas, usar **comando único**, por ser mais rápido e não haver ambiguidade entre camisa e código:

- `12U2 Enter` ou `12 U2 Enter`;
- `87P2 Enter`;
- `12T1 Enter`;
- entrada normalizada sem exigir maiúsculas.

Isso economiza a transição adicional de `Enter` usada na pontuação e mantém uma entrada por falta.

### Faltas FIBA 2024

Corrigir o modelo atual, que trata `U2` como duas faltas U. No modelo 2024:

- separar **tipo da falta** da **penalidade de lances livres**;
- preservar também a notação original da súmula;
- exemplo: `U2` = uma falta `U` com penalidade `2`, não duas faltas antidesportivas.

Persistir pelo menos:

- tipo semântico;
- quantidade de LL da penalidade;
- notação original;
- período;
- sequência;
- equipe;
- alvo da falta.

Suportar a notação 2024 necessária para jogadores e banco/comissão, incluindo P/T/U/D e as marcações de técnico/banco aplicáveis, preservando seus números de penalidade.

As regras de GD devem trabalhar sobre o **tipo da falta**, independentemente da quantidade de LL:

- D → GD;
- 2 T → GD;
- 2 U → GD;
- T + U → GD.

Após o evento que gera GD, impedir outra falta daquele atleta. Dados de períodos posteriores à desqualificação também permanecem inválidos. Pontuação dentro do mesmo período não deve ser rejeitada apenas pela ordem de transcrição, pois a súmula manual não terá cronologia global suficiente para afirmar se ocorreu antes ou depois da falta.

Os números das penalidades devem permitir calcular separadamente **LL de penalidade concedidos e recebidos**, sem confundir esse número com `freeThrowMade`.

### Preparação para FIBA 2026

Esta PR implementará exclusivamente **FIBA 2024**, mesmo para inserções feitas em 2026.

Adicionar um identificador explícito como `foul_rules_version = FIBA_2024`; não inferir versão pela data da partida e não usar `competition_ruleset_revision` para essa finalidade.

O parser e o avaliador de faltas devem depender de um perfil de regras versionado. A estrutura `tipo + penalidade + notação` deve permitir posteriormente adicionar as novas categorias de técnica e as faltas disruptiva/flagrante de 2026 sem reinterpretar registros de 2024 ou alterar a estrutura principal do banco.

## Persistência, revisão e interfaces

- Evoluir `game_roster_slots` no fluxo manual para gravar `is_starter` e `is_captain`, hoje já existentes no banco.
- Criar armazenamento próprio para:
  - técnico/primeiro assistente por equipe;
  - origem do técnico (`manual` ou `captain_placeholder`);
  - oficiais da partida;
  - observações/metadados que ainda não pertencem ao jogo.
- Evoluir `foul_events` para guardar a semântica correta da falta e a penalidade separadamente; migrar `U2` legado sem perder a notação original.
- Faltas de técnico/banco não devem ser forçadas para um `game_roster_slot`; devem ter representação própria de alvo/equipe.
- Criar um RPC transacional para **criação integrada jogo + súmula**, reutilizando internamente as validações existentes de criação de confronto e ingestão manual.
- Criar um RPC separado para **revisar súmula existente**.
- Após a primeira confirmação:
  - mandante e visitante ficam imutáveis;
  - podem mudar data/metadados, elenco/camisas, titular/capitão, comissão, oficiais, pontos e faltas.
- Cada correção deve:
  - carregar a revisão atualmente ativa;
  - apresentar diff legível antes da gravação, por exemplo `#12 Q2: 2PT 3 → 4`;
  - mostrar alterações de placar e metadados;
  - exigir motivo textual;
  - pedir confirmação final;
  - enviar `baseSubmissionId/hash` para rejeitar edição sobre versão desatualizada;
  - criar nova versão da submissão manual;
  - manter snapshots/revisões anteriores imutáveis;
  - registrar motivo, autor, data e diff na auditoria.
- Não criar resolução de conflito com boxscore ou etapas extras relacionadas a outras fontes nesta PR.

## Interface e fluxo

Manter um wizard simples:

1. **Jogo** — equipes, data e metadados.
2. **Equipe** — atletas, camisa, titulares, capitão, técnico e assistente.
3. **Lançamentos** — modo rápido para pontos e faltas, por equipe/período.
4. **Revisão** — placar, parciais, faltas/GD, comissão, oficiais e confirmação.

Arbitragem/mesa ficam em uma seção recolhível **“Oficiais da partida”**.

A grade atual permanece disponível para conferência e correções pontuais; o lançamento rápido passa a ser a experiência principal.

Todos os controles devem funcionar por teclado, manter foco visível, labels associados e mensagens de erro programaticamente ligadas ao campo. Alterações de estado como entrada aceita, camisa inexistente ou atleta já em GD devem ter feedback textual acessível sem retirar o foco do campo principal.

O rascunho continua somente em `localStorage`, separado por competição/jogo e versão do editor. Nenhum rascunho será criado no servidor.

## Testes e critérios de aceite

- Criação transacional:
  - sucesso cria matchup, jogo e súmula juntos;
  - falha em qualquer validação não deixa jogo parcial;
  - repetição da mesma idempotency key não duplica registros.
- Pontuação rápida:
  - sequência completa sem mouse;
  - camisas `0`, `00` e `1–99`;
  - rejeição de camisa inexistente e valor diferente de 1/2/3;
  - undo e cancelamento de entrada parcial.
- Faltas:
  - `U2` conta como uma U e dois LL;
  - `T1`, `P1/P2/P3`, `U2`, `D…` e códigos de banco permitidos pelo perfil 2024 preservam sua notação;
  - 2T, 2U, T+U e D geram GD no evento correto;
  - nenhuma nova falta pode ser lançada para atleta já desqualificado;
  - soma de LL de penalidade cedidos/recebidos usa a quantidade preservada, não o número de faltas.
- Elenco:
  - capitão e titulares são persistidos;
  - no máximo um capitão por equipe;
  - atleta/camisa duplicados continuam bloqueados;
  - assistente vazio é aceito;
  - botão de capitão como técnico preenche corretamente e mantém `captain_placeholder`.
- Revisão:
  - equipes não podem mudar;
  - diff apresenta antes/depois;
  - motivo é obrigatório;
  - versão anterior permanece consultável;
  - tentativa baseada em revisão desatualizada é rejeitada.
- Metadados:
  - somente mandante, visitante e data obrigatórios;
  - todos os demais campos podem ficar vazios.
- Executar testes focais durante a implementação e, ao estabilizar, gate completo exigido pelo repositório: lint/formatação em modo de verificação, typecheck, testes afetados, pgTAP/RLS, build, verificação de segredos e validação de teclado/acessibilidade da tela alterada.

## Premissas fechadas

- PR e worktree exclusivos para esta feature, preservando integralmente o estado não relacionado atualmente existente no workspace.
- Uso pós-jogo e desktop.
- FIBA 2024 é a única regra operacional desta versão.
- FIBA 2026 influencia apenas a arquitetura extensível; seus novos códigos e regras não serão aceitos nesta PR.
- Pontos continuam agregados por atleta/período.
- A sequência recente de pontos é operacional e local.
- A sequência das faltas continua persistida porque é necessária para GD.
- Técnico e primeiro assistente são opcionais.
- “Usar capitão como técnico” é deliberadamente simples para o operador, mas sua origem fica preservada internamente.
- Boxscore permanece fora do fluxo e da interface desta súmula.
