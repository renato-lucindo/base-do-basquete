# Tabelas relacionadas ao perfil dos jogadores

Inventário do modelo atual do `base-do-basquete`, com comparação das estruturas existentes no `site-bask`.

- Projeto principal: [renato-lucindo/base-do-basquete](https://github.com/renato-lucindo/base-do-basquete)
- Projeto de referência: [renato-lucindo/site-bask](https://github.com/renato-lucindo/site-bask)
- Data do levantamento: 24/08/2026

## Mapa dos relacionamentos

```text
players
  └─ roster_entries
       ├─ team_registrations
       │    ├─ teams
       │    └─ competitions
       │         ├─ competition_series
       │         └─ categories
       └─ game_roster_slots
            ├─ games
            ├─ player_period_stats
            └─ foul_events

final_placements + roster_entries
  └─ player_achievements (view)

player_period_stats + game_roster_slots + players
  ├─ game_player_statistics (view)
  └─ competition_player_statistics (view)

game_roster_slots + roster_entries
  ├─ player_jersey_history (view)
  └─ player_primary_jerseys (view)
```

## Classificação das estruturas

| Tipo | Estruturas |
|---|---|
| Perfil e identidade | `players` |
| Vínculo esportivo | `roster_entries`, `team_registrations`, `teams`, `competitions`, `competition_series`, `categories` |
| Participação em jogos | `games`, `game_participants`, `game_roster_slots` |
| Estatísticas autoritativas | `player_period_stats`, `foul_events` |
| Resultados e conquistas | `final_placements` |
| Views para o perfil público | `competition_player_statistics`, `game_player_statistics`, `player_achievements`, `player_jersey_history`, `player_primary_jerseys` |
| Auxiliar administrativo | `boxscore_import_player_matches` |
| Contexto opcional do jogo | `game_statistics`, `game_team_statistics`, `game_periods`, `game_period_scores`, `game_scores` |

---

## 1. `players` — identidade do atleta

Tabela principal e autoritativa do jogador.

| Campo atual | Tipo | Obrigatório | Finalidade |
|---|---|---:|---|
| `id` | `bigint` | sim | Identificador interno |
| `full_name` | `text` | sim | Nome completo, entre 2 e 160 caracteres |
| `slug` | `text` | sim | Identificador público usado na URL; único |
| `birth_date` | `date` | não | Data de nascimento |
| `is_active` | `boolean` | sim | Controla disponibilidade administrativa |
| `is_public` | `boolean` | sim | Controla exposição pública |
| `created_at` | `timestamptz` | sim | Auditoria de criação |
| `updated_at` | `timestamptz` | sim | Auditoria de atualização |

### Alterações desejadas

- [ ] Manter como está
- [x] Adicionar `nickname`
- [x] Adicionar `bio`
- [x] Adicionar `height_cm`
- [x] Adicionar `weight_kg`
- [x] Adicionar `primary_position`
- [ ] Adicionar foto do atleta
- [x] Adicionar cidade/estado de origem
- [ ] Adicionar campos de privacidade individuais
- [x] Outra alteração: mão dominante
- [x] Outra alteração: Nº de Registro. É o número do atleta na federação, não é obrigatório e não será público no perfil do atleta por padrão.

**Observações:**

> ao inves de apenas o ano de nascimento terá como colocar a data completa, porém não de forma obrigatória e o dado não será publico de padrão, diferente do ano de nascimento
>
> Decisão: haverá um único `federation_no` por atleta. A data completa e o registro federativo serão privados; os demais campos opcionais do perfil serão públicos por padrão.
> 

---

## 2. `roster_entries` — atleta inscrito por equipe e edição

Esta tabela substitui a ideia de guardar o time diretamente em `players`. É o vínculo histórico correto para descobrir por qual equipe o atleta atuou em cada edição.

| Campo atual | Tipo | Obrigatório | Finalidade |
|---|---|---:|---|
| `id` | `bigint` | sim | Identificador da inscrição individual |
| `competition_id` | `bigint` | sim | Edição da competição |
| `registration_id` | `bigint` | sim | Inscrição da equipe |
| `player_id` | `bigint` | sim | Jogador |
| `jersey_number` | `text` | não | Camisa na edição; aceita `00` |
| `status` | `text` | sim | `active` ou `inactive` |
| `joined_on` | `date` | não | Início do vínculo na edição |
| `left_on` | `date` | não | Fim do vínculo na edição |
| `created_at` | `timestamptz` | sim | Auditoria |
| `updated_at` | `timestamptz` | sim | Auditoria |

### Alterações desejadas

- [ ] Manter como está
- [x] Adicionar posição específica na equipe
- [ ] Adicionar função/categoria do atleta na edição
- [ ] Adicionar motivo de inativação
- [ ] Outra alteração: 

**Observações:**

> Decisão: descartar o campo de função/categoria. A categoria já pertence à competição; titularidade e capitania permanecem vinculadas ao jogo.

---

## 3. `team_registrations` — inscrição da equipe na edição

| Campo atual | Tipo | Obrigatório | Finalidade |
|---|---|---:|---|
| `id` | `bigint` | sim | Identificador da inscrição |
| `competition_id` | `bigint` | sim | Edição |
| `team_id` | `bigint` | sim | Equipe |
| `status` | `text` | sim | Estado da inscrição |
| `confirmed_at` | `timestamptz` | não | Confirmação da inscrição |
| `created_at` | `timestamptz` | sim | Auditoria |
| `updated_at` | `timestamptz` | sim | Auditoria |

**Uso no perfil:** identifica a equipe correta do atleta em cada competição.

**Alterações/observações:**

> 

---

## 4. `teams` — equipes associadas ao atleta

| Campo atual | Tipo | Obrigatório | Finalidade |
|---|---|---:|---|
| `id` | `bigint` | sim | Identificador |
| `name` | `text` | sim | Nome da equipe |
| `slug` | `text` | sim | URL pública; único |
| `abbreviation` | `text` | não | Sigla pesquisável |
| `is_active` | `boolean` | sim | Disponibilidade administrativa |
| `is_public` | `boolean` | sim | Visibilidade pública |
| `created_at` | `timestamptz` | sim | Auditoria |
| `updated_at` | `timestamptz` | sim | Auditoria |

**Alterações/observações:**

> 

---

## 5. `competitions` — edição das estatísticas

| Campo atual | Tipo | Obrigatório | Finalidade |
|---|---|---:|---|
| `id` | `bigint` | sim | Identificador da edição |
| `display_name` | `text` | sim | Nome público |
| `year` | `integer` | sim | Ano |
| `series_id` | `bigint` | sim | Série/campeonato |
| `category_id` | `bigint` | sim | Categoria |
| `status` | `text` | sim | Estado da edição |
| `starts_on` | `date` | não | Início |
| `ends_on` | `date` | não | Encerramento |
| `published_at` | `timestamptz` | não | Publicação |
| `created_at` | `timestamptz` | sim | Auditoria |
| `updated_at` | `timestamptz` | sim | Auditoria |

**Uso no perfil:** separa estatísticas, equipes, camisas e conquistas por edição.

**Alterações/observações:**

> 

---

## 6. `competition_series` e `categories`

Estruturas de apoio usadas para nomear e contextualizar as edições exibidas no perfil.

### `competition_series`

| Campo principal | Finalidade |
|---|---|
| `id` | Identificador |
| `name` | Nome do campeonato/série |
| `slug` | Segmento da URL |
| `is_active` | Disponibilidade |

### `categories`

| Campo principal | Finalidade |
|---|---|
| `id` | Identificador |
| `name` | Nome da categoria |
| `slug` | Segmento da URL |
| `has_advanced_stats` | Define perfil estatístico simples ou avançado |
| `is_active` | Disponibilidade |

**Alterações/observações:**

> 

---

## 7. `games` — jogos do histórico do atleta

| Campo atual | Tipo | Finalidade |
|---|---|---|
| `id` | `bigint` | Identificador do jogo |
| `competition_id` | `bigint` | Edição |
| `game_number` | `text` | Número oficial |
| `scheduled_at` | `timestamptz` | Data e horário |
| `started_at` | `timestamptz` | Início real |
| `ended_at` | `timestamptz` | Encerramento |
| `venue` | `text` | Local |
| `status` | `text` | Estado do jogo |
| `source` | `text` | Origem dos dados |
| `created_at` | `timestamptz` | Auditoria |
| `updated_at` | `timestamptz` | Auditoria |

**Uso no perfil:** lista de jogos e contexto temporal das estatísticas.

**Alterações/observações:**

> 

---

## 8. `game_participants` — equipes participantes do jogo

| Campo atual | Tipo | Finalidade |
|---|---|---|
| `game_id` | `bigint` | Jogo |
| `competition_id` | `bigint` | Edição |
| `registration_id` | `bigint` | Equipe inscrita |
| `side` | `text` | `home` ou `away` |

**Uso no perfil:** identifica adversário e lado da equipe nos jogos do atleta.

**Alterações/observações:**

> 

---

## 9. `game_roster_slots` — participação individual no jogo

| Campo atual | Tipo | Finalidade |
|---|---|---|
| `id` | `bigint` | Identificador do slot |
| `game_id` | `bigint` | Jogo |
| `registration_id` | `bigint` | Equipe |
| `roster_entry_id` | `bigint` ou nulo | Atleta relacionado |
| `slot_number` | `integer` | Posição na súmula |
| `jersey_number` | `text` ou nulo | Camisa usada no jogo |
| `is_applicable` | `boolean` | Slot utilizado |
| `did_not_play` | `boolean` | Não jogou |
| `is_starter` | `boolean` | Titular |
| `is_captain` | `boolean` | Capitão |
| `disqualification_reason` | `text` ou nulo | Motivo de desqualificação |
| `disqualified_at_period` | `integer` ou nulo | Período da desqualificação |
| `created_at` | `timestamptz` | Auditoria |

### Alterações desejadas

- [ ] Manter como está
- [ ] Exibir titularidade no perfil
- [ ] Exibir jogos como capitão
- [ ] Exibir desqualificações
- [ ] Outra alteração: 

**Observações:**

> 

---

## 10. `player_period_stats` — estatísticas autoritativas

Uma linha representa as estatísticas de um atleta em um período do jogo.

| Grupo | Campos atuais |
|---|---|
| Chaves | `game_id`, `game_roster_slot_id`, `period_number` |
| Participação | `seconds_played`, `stat_scope` |
| Pontos | `points` |
| 2 pontos | `two_point_made`, `two_point_attempted` |
| 3 pontos | `three_point_made`, `three_point_attempted` |
| Lances livres | `free_throw_made`, `free_throw_attempted` |
| Rebotes | `offensive_rebounds`, `defensive_rebounds` |
| Outras estatísticas | `assists`, `turnovers`, `steals`, `blocks`, `plus_minus` |

### Alterações desejadas

- [ ] Manter como está
- [ ] Adicionar campo estatístico: 
- [ ] Alterar forma de cálculo de: 
- [ ] Exibir divisão por período no perfil
- [ ] Exibir somente total do jogo

**Observações:**

> 

---

## 11. `foul_events` — faltas individuais

| Campo atual | Tipo | Finalidade |
|---|---|---|
| `id` | `bigint` | Identificador |
| `game_id` | `bigint` | Jogo |
| `game_roster_slot_id` | `bigint` | Atleta no jogo |
| `period_number` | `integer` | Período |
| `sequence_number` | `integer` | Ordem da falta |
| `foul_code` | `text` | Código da falta |
| `elapsed_seconds` | `integer` ou nulo | Momento da ocorrência |
| `created_at` | `timestamptz` | Auditoria |

### Alterações desejadas

- [ ] Mostrar total de faltas no perfil
- [ ] Mostrar tipos de falta
- [ ] Mostrar desqualificações derivadas
- [ ] Não exibir faltas no perfil

**Observações:**

> 

---

## 12. `final_placements` — origem das conquistas

| Campo atual | Tipo | Finalidade |
|---|---|---|
| `id` | `bigint` | Identificador |
| `competition_id` | `bigint` | Edição |
| `registration_id` | `bigint` | Equipe inscrita |
| `result_status` | `text` | Estado do resultado |
| `placement` | `integer` ou nulo | Colocação |
| `result_label` | `text` ou nulo | Rótulo especial |
| `confirmed_at` | `timestamptz` ou nulo | Confirmação |
| `confirmed_by` | `uuid` ou nulo | Administrador responsável |
| `created_at` | `timestamptz` | Auditoria |
| `updated_at` | `timestamptz` | Auditoria |

**Uso no perfil:** em conjunto com o elenco, deriva títulos e colocações do atleta.

**Alterações/observações:**

> 

---

# Views derivadas usadas no perfil

Estas estruturas não devem ser editadas como tabelas de cadastro. Alterações nelas devem ser feitas pela migration que define a view ou nas tabelas de origem.

## 13. `competition_player_statistics`

Agrega as estatísticas do atleta por edição.

| Grupo | Campos |
|---|---|
| Identificação | `competition_id`, `player_id`, `player_name`, `player_slug` |
| Participação | `games_played`, `seconds_played` |
| Pontos e arremessos | `points`, `two_point_made`, `two_point_attempted`, `three_point_made`, `three_point_attempted`, `free_throw_made`, `free_throw_attempted` |
| Demais métricas | `offensive_rebounds`, `defensive_rebounds`, `assists`, `turnovers`, `steals`, `blocks`, `plus_minus` |

### Alterações desejadas na view

- [x] Incluir faltas
- [x] Incluir equipe e sigla na edição
- [x] Incluir camisa da edição
- [x] Incluir titularidades
- [ ] Incluir jogos como capitão
- [ ] Outra alteração: 

**Observações:**

> 

---

## 14. `game_player_statistics`

Agrega o boxscore individual de cada jogo.

| Grupo | Campos |
|---|---|
| Jogo e atleta | `game_id`, `competition_id`, `game_roster_slot_id`, `player_id`, `player_name`, `player_slug` |
| Equipe | `registration_id`, `team_id`, `team_name`, `team_slug`, `side` |
| Participação | `jersey_number`, `did_not_play`, `seconds_played` |
| Pontos e arremessos | `points`, `two_point_made`, `two_point_attempted`, `three_point_made`, `three_point_attempted`, `free_throw_made`, `free_throw_attempted` |
| Demais métricas | `offensive_rebounds`, `defensive_rebounds`, `assists`, `turnovers`, `steals`, `blocks`, `plus_minus`, `fouls` |

### Alterações desejadas na view

- [ ] Incluir titularidade
- [ ] Incluir indicação de capitão
- [ ] Incluir número e data do jogo já resolvidos
- [ ] Incluir adversário
- [ ] Outra alteração: 

**Observações:**

> 

---

## 15. `player_achievements`

Deriva conquistas confirmadas de `final_placements`, `team_registrations` e `roster_entries`.

| Campos atuais |
|---|
| `player_id` |
| `competition_id`, `competition_display_name`, `year` |
| `series_name`, `series_slug` |
| `category_name`, `category_slug` |
| `registration_id` |
| `team_id`, `team_name`, `team_slug` |
| `placement`, `result_label`, `confirmed_at` |

### Alterações desejadas

- [ ] Manter somente conquistas coletivas derivadas
- [x] Criar também honrarias individuais manuais
- [ ] Exibir apenas títulos
- [ ] Exibir todas as colocações confirmadas

**Observações:**

> 

---

## 16. `player_jersey_history`

Histórico de camisas efetivamente usadas em jogos.

| Campo | Finalidade |
|---|---|
| `player_id` | Jogador |
| `competition_id` | Edição |
| `game_id` | Jogo |
| `jersey_number` | Camisa usada |
| `used_at` | Data de uso |

**Alterações/observações:**

> 

---

## 17. `player_primary_jerseys`

Determina a camisa histórica mais utilizada.

| Campo | Finalidade |
|---|---|
| `player_id` | Jogador |
| `jersey_number` | Camisa predominante |
| `game_count` | Quantidade de jogos |
| `most_recent_use` | Uso mais recente |

**Alterações/observações:**

> 

---

# Estruturas auxiliares e opcionais

## 18. `boxscore_import_player_matches`

Usada para associar nomes encontrados no PDF aos atletas/elencos cadastrados. Não deve alimentar diretamente o perfil público antes da importação ser validada.

Campos mais relevantes: `source_player_name`, `source_jersey_number`, `suggested_player_id`, `roster_entry_id`, `similarity_score`, `status`, `resolution_kind` e `decided_at`.

**Alterações/observações:**

> 

## 19. Estruturas de contexto da partida

Podem aparecer na página do jogo acessada pelo perfil, mas não descrevem diretamente o atleta:

- `game_periods`
- `game_period_scores` — view
- `game_scores` — view
- `game_statistics`
- `game_team_statistics`

---

# Estruturas existentes no `site-bask`

## 20. `player_profiles`

Tabela 1:1 com `players` que não existe atualmente no `base-do-basquete`.

| Campo no `site-bask` | Observação para o projeto principal |
|---|---|
| `player_id` | Chave primária e estrangeira para `players` |
| `nickname` | Necessário para a busca por apelido solicitada |
| `bio` | Texto público do perfil |
| `birth_year` | O projeto principal já possui `birth_date`, que é mais preciso |
| `height_cm` | Pode ser incorporado |
| `weight_kg` | Pode ser incorporado |
| `awards` | JSON; não é recomendável copiar sem definir estrutura |
| `created_at` | Auditoria |
| `updated_at` | Auditoria |

### Decisão

- [x] Criar `player_profiles` separado, 1:1
- [ ] Incorporar os novos campos em `players`
- [ ] Criar somente `nickname`
- [ ] Não aproveitar esta tabela

**Campos escolhidos:**

> `bio`, `height_cm`, `weight_kg`, `main_position`, `hand`, `home_city` e `home_state`. Os campos serão públicos por padrão.

---

## 21. `player_honors`

Honrarias individuais manuais do `site-bask`.

| Campo | Finalidade |
|---|---|
| `id` | Identificador |
| `player_id` | Jogador |
| `competition_id` | Edição opcional |
| `title` | Título da honraria |
| `description` | Descrição opcional |
| `year` | Ano opcional |
| `created_at` | Auditoria |
| `updated_at` | Auditoria |

Exemplos: MVP, cestinha, seleção do campeonato ou prêmio defensivo. Essa tabela não deve substituir `player_achievements`, que deriva títulos e colocações coletivas confirmadas.

### Decisão

- [x] Criar tabela de honrarias individuais
- [ ] Usar apenas conquistas coletivas derivadas
- [ ] Revisar futuramente

**Observações:**

> Criar `player_honors` separadamente das conquistas coletivas derivadas.

---

## 22. `player_teams`

No `site-bask`, registra o histórico atleta–equipe–competição. Não precisa ser copiada: `roster_entries` + `team_registrations` já representam esse vínculo de maneira mais rigorosa no `base-do-basquete`.

- [x] Não duplicar no projeto principal
- [ ] Reavaliar o modelo atual

**Observações:**

> 

---

# Decisões gerais sobre o perfil

## Informações do cabeçalho

- [ ] Nome completo
- [ ] Apelido
- [ ] Foto
- [ ] Idade
- [ ] Altura
- [ ] Peso
- [ ] Posição
- [ ] Equipe e camisa na edição
- [ ] Camisa histórica principal
- [ ] Biografia

## Estatísticas

- [ ] Resumo da edição atual
- [ ] Totais da edição
- [ ] Médias da edição
- [ ] Resumo da carreira
- [ ] Estatísticas por competição
- [ ] Estatísticas por jogo
- [ ] Estatísticas por período
- [ ] Faltas
- [ ] Titularidades
- [ ] Jogos como capitão

## Histórico

- [ ] Equipes por edição
- [ ] Camisas utilizadas
- [ ] Lista de jogos
- [ ] Conquistas coletivas
- [ ] Honrarias individuais

## Privacidade

- [ ] Um único `is_public` para todo o jogador
- [ ] Visibilidade separada para nascimento/idade
- [ ] Visibilidade separada para altura e peso
- [ ] Visibilidade separada para foto e biografia
- [ ] Ocultar dados pessoais de menores por padrão

## Observações finais

> Não renomear views ou tabelas existentes em produção. Os nomes reduzidos serão usados somente em novas colunas e estruturas quando aplicável.
>
> Perfil público: escolhida uma navegação por âncoras com aparência de abas. Ordem final: `Resumo`, `Estatísticas`, `Conquistas e honrarias`, `Jogos` e `Histórico`.
>
> Cada aba direcionará para a seção correspondente na mesma página, usando os identificadores `#resumo`, `#estatisticas`, `#conquistas-honrarias`, `#jogos` e `#historico`. A navegação deverá permanecer acessível durante a rolagem, indicar a seção atual e funcionar com teclado, histórico do navegador e telas pequenas.

