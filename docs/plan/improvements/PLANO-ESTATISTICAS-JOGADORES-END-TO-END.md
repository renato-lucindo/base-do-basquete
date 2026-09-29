# Plano objetivo — Estatísticas públicas de jogadores com boxscore

## 1. Escopo

Esta página é exclusiva para competições cujo perfil publicado possui
`primary_source = 'fiba_boxscore'`. Isso inclui os contratos FIBA/Genius Sports e
Basketball Site.

Competições com fonte primária `manual_scoresheet` terão página, contrato e plano próprios.
O backend deve impedir que súmula, contexto legado ou perfil pendente usem o DTO, a consulta
ou o componente desta página.

## 2. Modos estatísticos

A página terá três modos:

1. `Por jogo` — padrão;
2. `Total`;
3. `Por 30 min.`.

### Catálogo público

| Sigla | Estatística |
|---|---|
| J | Jogos |
| MIN | Minutos |
| PTS | Pontos |
| REB | Rebotes |
| RO/RD | Rebotes ofensivos/defensivos |
| AST | Assistências |
| ER | Erros |
| TO | Tocos |
| BR | Bolas recuperadas |
| FC | Faltas cometidas |
| FR | Faltas recebidas |
| AC/AT | Arremessos convertidos/tentados |
| LL | Lances livres |
| EF | Eficiência |
| +/- | Saldo em quadra |
| AP | Aproveitamento |

### Por 30 min.

Fórmula autoritativa:

```text
valor por 30 = total coberto × 1800 ÷ segundos cobertos
```

Regra de amostra mínima:

```text
segundos cobertos >= 600
```

O atleta precisa acumular pelo menos **10 minutos totais jogados** no escopo selecionado.

- Abaixo do mínimo, o atleta continua visível.
- As métricas que seriam normalizadas mostram `-` e “Amostra insuficiente”.
- Identificação, J, percentuais e `+/-` permanecem visíveis quando possuírem cobertura.
- O atleta não participa de líderes, filtros ou comparação das métricas normalizadas por 30.
- Exatamente 10 minutos torna o atleta elegível.
- A regra é aplicada no backend e versionada na publicação.

São normalizadas as métricas de contagem cuja cobertura coincide com os minutos: PTS
avançados, arremessos convertidos/tentados, REB, RO, RD, AST, BR, TO, ER, FC, FR e EF.

Não são normalizados:

- `J`;
- percentuais, sempre calculados por convertidos ÷ tentados acumulados;
- `+/-`, que mantém o mesmo valor adotado em `Por jogo` e não é escalado por minutos.

Ao selecionar `Por 30 min.`, a coluna `MIN` é ocultada automaticamente. Essa ocultação é
temporária: a preferência do usuário não é apagada e `MIN` volta ao retornar para `Por jogo`
ou `Total`.

Fallback manual e jogos sem minutos não entram no numerador nem no denominador por 30.

## 3. Escopo dos jogos

A página terá três opções:

1. `Fase regular` — padrão;
2. `Eliminatórias`;
3. `Todos`.

A classificação é autoritativa:

```text
game.matchup_id
→ matchups.round_id
→ competition_rounds.stage_id
→ competition_stages.stage_kind
```

| `stage_kind` | Escopo |
|---|---|
| `round_robin` | Fase regular |
| `knockout` | Eliminatórias (`playoffs` no contrato público) |
| nulo ou `legacy_unclassified` | Somente Todos |

Regras:

- não inferir fase por nome, código, data, rodada ou número do jogo;
- considerar somente jogos finais e publicados;
- `Todos` inclui fase regular, Eliminatórias e jogos não classificados;
- jogos não classificados nunca entram silenciosamente na fase regular;
- escopo sem jogos mostra estado vazio, sem fallback automático;
- trocar o escopo recalcula estatísticas, cobertura, líderes, filtros e paginação.

## 4. Publicação e read model

Criar snapshot estatístico append-only na mesma transação da publicação.

Grão recomendado:

```text
publication_id + scope + registration_id + player_id
```

O snapshot terá linhas para `regular`, `playoffs` e `all` e congelará:

- competição, publicação e perfil de dados;
- contrato `boxscore`;
- inscrição, equipe, atleta e camisa contextual;
- escopo estrutural de cada jogo;
- totais canônicos anuláveis;
- faltas recebidas anuláveis, persistidas quando fornecidas pela fonte;
- segundos e jogos cobertos por domínio;
- regra `Por 30 min.` e mínimo de 600 segundos;
- contagem de jogos regulares, Eliminatórias e não classificados.

Ausência permanece `null`; zero só representa valor coberto e realmente igual a zero.
Na apresentação, `-` significa amostra inferior a 10 minutos e `—` significa dado não
fornecido pela fonte.
Alterações posteriores só chegam ao público após nova publicação.

## 5. Backend e consulta

Criar consulta server-side exclusiva para boxscore.

Parâmetros allowlisted:

```ts
type StatisticsMode = "per-game" | "total" | "per-30";
type GameScope = "regular" | "playoffs" | "all";
```

A consulta também recebe busca, equipe, filtros, ordenação, página e comparação.

Responsabilidades do backend:

- validar elegibilidade pela publicação atual;
- aplicar modo e escopo ao mesmo conjunto de jogos;
- executar busca, filtros, ordenação, líderes e paginação;
- limitar a 20 linhas por página;
- manter indisponíveis no fim da ordenação;
- carregar comparados mesmo fora da página atual;
- calcular líderes antes da paginação;
- rejeitar métricas, operadores e escopos não allowlisted;
- nunca aceitar SQL, `stage_id`, fonte ou contrato enviados pelo navegador.

A consulta pública deve usar RLS, `FORCE ROW LEVEL SECURITY`, grants mínimos e
`SECURITY INVOKER`.

## 6. URL e estado

Parâmetros canônicos:

```text
mode=per-game|total|per-30
scope=regular|playoffs|all
```

- `per-game` e `regular` são padrões e podem ser omitidos da URL.
- Valores inválidos voltam ao padrão seguro.
- Trocar modo ou escopo reinicia `page`.
- Busca, equipe, filtros, colunas e ordenação compatíveis são preservados.
- Recarregar, compartilhar e usar voltar/avançar restaura o mesmo estado.
- Se a ordenação ativa for `MIN` ao entrar em `Por 30 min.`, usar `PTS` decrescente.
- Filtros de `MIN` não são aplicados em `Por 30 min.`.

## 7. Interface

- Controles principais: busca por atleta/equipe, equipe, modo e escopo.
- Ações secundárias: filtros, colunas e comparação.
- Colunas essenciais: posição, atleta, equipe, J, MIN, PTS, REB, AST, AP, LL e EF.
- Em `Por 30 min.`, `MIN` não aparece nem pode ser reativada até a troca de modo.
- Manter cabeçalho e atleta fixos.
- Exibir camisa contextual; usar `var.` quando houver números diferentes no escopo.
- Líderes usam todo o conjunto filtrado, nunca somente a página atual.
- Empates recebem o mesmo destaque.
- Destaques e comparação não dependem apenas de cor.
- A região horizontal deve ser focalizável e operável por teclado.
- Não adicionar novo hero ou cabeçalho próprio nesta unidade.

## 8. Pacotes de implementação

### STATS-00 — Baseline

- congelar URLs, métricas e comportamento atuais;
- criar oráculos para FIBA/Genius, Basketball Site e cobertura parcial;
- registrar as nove combinações de modo × escopo;
- registrar os limites de 9:59 e 10:00;
- documentar como divergência o uso atual do explorador genérico por súmula/legado.

### STATS-01 — Snapshot

- criar migration aditiva;
- congelar contrato boxscore e escopo estrutural por publicação;
- agregar `regular`, `playoffs` e `all`;
- adicionar persistência canônica anulável para `foulsReceived`, incluindo commit FIBA,
  retroprojeção histórica segura, cobertura própria e `null` no Basketball Site;
- aplicar RLS, grants e testes pgTAP;
- regenerar tipos TypeScript.

### STATS-02 — Backend e domínio

- criar DTO exclusivo de boxscore;
- implementar parser de `mode` e `scope`;
- mover filtros, ordenação, líderes, comparação e paginação ao servidor;
- implementar denominadores, percentuais e regra por 30;
- expor `FR` quando fornecida; Basketball Site mantém `FR` indisponível;
- centralizar a nomenclatura deste plano em um catálogo único de métricas.

### STATS-03 — Interface

- integrar os três modos e os três escopos;
- reorganizar os controles sem remover funcionalidades;
- aplicar paginação server-side;
- tratar vazio, erro, cobertura parcial e amostra insuficiente;
- validar teclado, leitor de tela, zoom e responsividade.

### STATS-04 — Rollout

- manter read models anteriores durante uma versão de rollback;
- validar preview com FIBA/Genius, Basketball Site e cobertura parcial;
- executar gate completo e revisões independentes;
- remover legado somente em unidade futura comprovadamente segura.

## 9. Testes obrigatórios

### Fases

- `round_robin` entra em `regular` e `all`;
- `knockout` entra em `playoffs` e `all`;
- não classificado entra somente em `all`;
- jogos agendados, ao vivo, draft ou não publicados não entram;
- fase vazia não muda automaticamente para outro escopo.

### Por 30 min.

- 9:59 é amostra insuficiente;
- 10:00 é elegível;
- zero minutos não causa divisão;
- percentuais não mudam entre modos;
- `+/-` não muda apenas pela troca para Por 30;
- `MIN` é ocultada em Por 30 e restaurada nos outros modos sem perder a preferência;
- numerador e minutos usam exatamente a mesma cobertura;
- elegibilidade é recalculada em cada escopo;
- indisponíveis ficam fora de líderes, filtros e comparação por 30.

### Segurança e consistência

- súmula, legado e perfil pendente não acessam a consulta boxscore;
- URL manipulada não altera fonte ou contrato;
- publicação antiga permanece imutável;
- republicação troca o snapshot atomicamente;
- competição, naipe, publicação e escopo permanecem isolados;
- valores privados e metadados administrativos não aparecem no contrato público.
- `FR` FIBA/Genius é preservada; `FR` Basketball Site permanece `null` e aparece como `—`.

### Interação

- nove combinações modo × escopo;
- busca, filtros, colunas, comparação, ordenação e paginação;
- URL, reload e voltar/avançar;
- teclado, foco, `aria-sort`, diálogo e tabela horizontal;
- 320, 390, 768 e 1440 px; zoom de 200%;
- nenhuma violação de acessibilidade serious/critical.

## 10. Gates

1. testes focais durante a implementação;
2. migration desde zero e pgTAP integral quando houver SQL;
3. lint, formatação, typecheck, testes, build e scan de segredos no HEAD estável;
4. preview com smoke, acessibilidade, responsividade e desempenho;
5. revisão de banco/segurança para STATS-01/STATS-02;
6. revisão de QA antes de merge ou release.

## 11. Estado atual

- STATS-00 concluído no commit `201508b`.
- STATS-01 implementado no commit `dd6a778`; migration e pgTAP passaram no banco desde zero
  da CI da PR #53, sem aplicação no Supabase compartilhado.
- STATS-02 e STATS-03 implementados localmente e em validação focal.
- `AGENT-CONFIG-01` foi isolado na PR #52 e não integra esta branch.
- Produção e Supabase compartilhado permanecem inalterados.

## 12. Próximo passo exato

```text
PROXIMO_PASSO_EXATO: concluir STATS-04 com gate integral, preview e revisões independentes no HEAD estável
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: PR #53, CI, preview, documentação de execução e HANDOFF.md
ACAO: enviar STATS-02/STATS-03, validar banco desde zero e interface responsiva, obter pareceres de banco/segurança e QA
CRITERIO_DE_CONCLUSAO: todos os checks e pareceres aprovados no mesmo commit, sem migration compartilhada nem produção
```
