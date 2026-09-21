# PR #35 — Plano acelerado orientado ao MVP

Este pacote substitui a fila operacional de 50 cartões pequenos por **5 pacotes verticais de MVP** e **4 pacotes pós-MVP**. Os cartões originais continuam preservados em `../tasks-pr35/` como requisitos e critérios de aceitação; eles deixam de exigir um ciclo separado de commit, CI, preview e handoff para cada item.

## Resultado esperado

O MVP estará pronto quando o administrador singleton em AAL2 conseguir:

1. criar uma edição privada por um preset validado;
2. cadastrar e organizar equipes e atletas;
3. gerar/agendar jogos dentro da estrutura esportiva;
4. registrar súmula manual ou importar um boxscore de contrato versionado no jogo existente;
5. publicar explicitamente a edição;
6. consultar a edição, jogos, classificação e jogadores na área pública sem vazamento de conteúdo privado.

O escopo completo não foi reduzido. Fallbacks entre fontes, conflitos avançados, remoção/retirada, editor genérico, clonagem, encerramento de grupos, W.O., emendas e enforcement final ficam em uma fila pós-MVP obrigatória.

## Estado de partida

- PR #35 aberta e em rascunho na branch `feature/admin-workflow-improvements`.
- `ADM-REF-00`, `01A–01G` e `02A–02C` concluídas.
- Supabase aplicado até `20260903074040_game_data_backfill`.
- 9 jogos, 9 submissões, 28 autoridades e reconciliação histórica pronta.
- Produção atual continua saudável e não deve ser alterada durante a construção do MVP.

## Ordem obrigatória de leitura

1. `AGENTS.md` na raiz do repositório;
2. `HANDOFF.md` na raiz do repositório;
3. este `README.md`;
4. `00-ESCOPO-E-CORTE.md`;
5. `01-REGRAS-INVIOLAVEIS.md`;
6. `REVISAO-DO-PLANO.md`;
7. `02-FILA-ACELERADA.md`;
8. somente o arquivo do pacote ativo em `pacotes/`;
9. `03-GATES-OTIMIZADOS.md`;
10. `04-PROMPT-DE-RETOMADA.md` ao iniciar outra sessão.

## Regra de autoridade

Este plano acelerado é a fila operacional. Em conflito de granularidade ou ordem com `../tasks-pr35/`, prevalece este pacote. As fontes normativas de produto e segurança no diretório pai continuam obrigatórias.

Não antecipar produção, ações destrutivas, remoção de colunas legadas, exposição de secrets, relaxamento de MFA/RLS ou mudança do formato FIBA documentado.

## Previsão

- MVP: 6 a 9 janelas de execução, alvo de **3 a 5 dias corridos** com retomadas automáticas.
- Pós-MVP completo: mais 7 a 11 janelas, alvo de **4 a 7 dias adicionais**.
- Intervenções humanas pendentes podem alongar apenas o enforcement final, não a entrega do MVP.
