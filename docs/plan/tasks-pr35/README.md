# PR #35 — pacote de execução em tasks retomáveis

Este diretório é a entrada operacional preferida. Cada task possui arquivo próprio; não execute o plano consolidado como um bloco único.

## Ordem de leitura

1. [Como usar e baseline](00-COMO-USAR.md);
2. [Regras globais](01-REGRAS-GLOBAIS.md);
3. [Protocolo e gates](02-PROTOCOLO-E-GATES.md);
4. [Fila e dependências](03-FILA-E-DEPENDENCIAS.md);
5. somente o arquivo da task atual;
6. [Prompt de retomada](04-PROMPT-DE-RETOMADA.md) ao abrir outra sessão;
7. [Manutenção do pacote](05-MANUTENCAO.md) ao mudar estados ou dependências.

## Regra de execução

- Existe somente uma task em escrita: `ADM-REF-01E` (`DOING`).
- Mude apenas a task elegível seguinte quando o gate da atual estiver concluído.
- Não abra outro cartão até concluir gate, commit, checks e handoff da task atual.
- `01H` e `02E` são condicionais, mas ambas devem terminar antes de `09A`.
- Merge e produção continuam proibidos sem autorização específica.

## Pacotes

| Pacote | Tema                                                                                       | Tasks |
| ------ | ------------------------------------------------------------------------------------------ | ----- |
| 00     | [Reconciliação e documentação](tasks/00-reconciliacao/README.md)                           | 1     |
| 01     | [Naipe, perfil, sexo privado e elegibilidade](tasks/01-perfil-privacidade/README.md)       | 8     |
| 02     | [Submissões, autoridade e vínculo estrutural](tasks/02-submissoes-autoridade/README.md)    | 5     |
| 03     | [Ingestão, fallback e conciliação](tasks/03-ingestao-conciliacao/README.md)                | 5     |
| 04     | [Página e métricas de jogadores de súmula](tasks/04-jogadores-sumula/README.md)            | 5     |
| 05     | [Regressão e autoridade do boxscore](tasks/05-jogadores-boxscore/README.md)                | 2     |
| 06     | [Administração, equipes e criação de edição](tasks/06-admin-competicoes-equipes/README.md) | 6     |
| 07     | [Regulamento, jogos e progressão](tasks/07-regulamento-progressao/README.md)               | 11    |
| 08     | [Publicação e área pública](tasks/08-publicacao-area-publica/README.md)                    | 4     |
| 09     | [Reconciliação, QA e fechamento da PR](tasks/09-qa-fechamento/README.md)                   | 3     |

## Manifesto das tasks

| Ordem | Task          | Estado inicial                                                           | Arquivo                                                                                                       |
| ----: | ------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
|     1 | `ADM-REF-00`  | `DONE`                                                                   | [ADM-REF-00 — Reconciliação e documentação](tasks/00-reconciliacao/ADM-REF-00.md)                             |
|     2 | `ADM-REF-01A` | `DONE`                                                                   | [ADM-REF-01A — Compatibilidade de naipe, sexo e perfil](tasks/01-perfil-privacidade/ADM-REF-01A.md)           |
|     3 | `ADM-REF-01B` | `DONE`                                                                   | [ADM-REF-01B — Contextos e rotas públicas por naipe](tasks/01-perfil-privacidade/ADM-REF-01B.md)              |
|     4 | `ADM-REF-01C` | `DONE`                                                                   | [ADM-REF-01C — Revisão administrativa de naipe e perfil](tasks/01-perfil-privacidade/ADM-REF-01C.md)          |
|     5 | `ADM-REF-01D` | `DONE`                                                                   | [ADM-REF-01D — Formulário privado de sexo do atleta](tasks/01-perfil-privacidade/ADM-REF-01D.md)              |
|     6 | `ADM-REF-01E` | `DOING`                                                                  | [ADM-REF-01E — Elegibilidade em elenco e transferência](tasks/01-perfil-privacidade/ADM-REF-01E.md)           |
|     7 | `ADM-REF-01F` | `BLOCKED` por `01E`                                                      | [ADM-REF-01F — Elegibilidade na confirmação de importação](tasks/01-perfil-privacidade/ADM-REF-01F.md)        |
|     8 | `ADM-REF-01G` | `BLOCKED` por `01F`                                                      | [ADM-REF-01G — Classificação/backfill administrativo](tasks/01-perfil-privacidade/ADM-REF-01G.md)             |
|     9 | `ADM-REF-01H` | `CONDITIONAL`                                                            | [ADM-REF-01H — Enforcement final de naipe/perfil](tasks/01-perfil-privacidade/ADM-REF-01H.md)                 |
|    10 | `ADM-REF-02A` | `BLOCKED` por `01G` e pelo registro da execução ou do adiamento de `01H` | [ADM-REF-02A — Tabela de submissões versionadas](tasks/02-submissoes-autoridade/ADM-REF-02A.md)               |
|    11 | `ADM-REF-02B` | `BLOCKED` por `02A`                                                      | [ADM-REF-02B — Autoridade por domínio e estado derivado](tasks/02-submissoes-autoridade/ADM-REF-02B.md)       |
|    12 | `ADM-REF-02C` | `BLOCKED` por `02B`                                                      | [ADM-REF-02C — Backfill de submissões e autoridades](tasks/02-submissoes-autoridade/ADM-REF-02C.md)           |
|    13 | `ADM-REF-02D` | `BLOCKED` por `02C`                                                      | [ADM-REF-02D — Invólucro estrutural legado e vínculo opcional](tasks/02-submissoes-autoridade/ADM-REF-02D.md) |
|    14 | `ADM-REF-02E` | `CONDITIONAL`                                                            | [ADM-REF-02E — Enforcement de novos jogos em confrontos](tasks/02-submissoes-autoridade/ADM-REF-02E.md)       |
|    15 | `ADM-REF-03A` | `BLOCKED` por `02B` e `02D`                                              | [ADM-REF-03A — Comparador e contratos puros de ingestão](tasks/03-ingestao-conciliacao/ADM-REF-03A.md)        |
|    16 | `ADM-REF-03B` | `BLOCKED` por `03A`                                                      | [ADM-REF-03B — Súmula no jogo existente](tasks/03-ingestao-conciliacao/ADM-REF-03B.md)                        |
|    17 | `ADM-REF-03C` | `BLOCKED` por `03B`                                                      | [ADM-REF-03C — Boxscore no jogo existente](tasks/03-ingestao-conciliacao/ADM-REF-03C.md)                      |
|    18 | `ADM-REF-03D` | `BLOCKED` por `03C`                                                      | [ADM-REF-03D — Fallback manual e suplemento boxscore](tasks/03-ingestao-conciliacao/ADM-REF-03D.md)           |
|    19 | `ADM-REF-03E` | `BLOCKED` por `03D`                                                      | [ADM-REF-03E — Revisão administrativa de conflitos](tasks/03-ingestao-conciliacao/ADM-REF-03E.md)             |
|    20 | `ADM-REF-04A` | `BLOCKED` por `03E`                                                      | [ADM-REF-04A — Read model de jogadores de súmula](tasks/04-jogadores-sumula/ADM-REF-04A.md)                   |
|    21 | `ADM-REF-04B` | `BLOCKED` por `04A`                                                      | [ADM-REF-04B — DTO discriminado e loader scoresheet](tasks/04-jogadores-sumula/ADM-REF-04B.md)                |
|    22 | `ADM-REF-04C` | `BLOCKED` por `04B`                                                      | [ADM-REF-04C — Listagem pública scoresheet](tasks/04-jogadores-sumula/ADM-REF-04C.md)                         |
|    23 | `ADM-REF-04D` | `BLOCKED` por `04C`                                                      | [ADM-REF-04D — Perfil contextual scoresheet](tasks/04-jogadores-sumula/ADM-REF-04D.md)                        |
|    24 | `ADM-REF-04E` | `BLOCKED` por `04D`                                                      | [ADM-REF-04E — Projeção compatível do boxscore raro](tasks/04-jogadores-sumula/ADM-REF-04E.md)                |
|    25 | `ADM-REF-05A` | `BLOCKED` por `04E`                                                      | [ADM-REF-05A — Read model boxscore orientado por autoridade](tasks/05-jogadores-boxscore/ADM-REF-05A.md)      |
|    26 | `ADM-REF-05B` | `BLOCKED` por `05A`                                                      | [ADM-REF-05B — Regressão visual da página boxscore](tasks/05-jogadores-boxscore/ADM-REF-05B.md)               |
|    27 | `ADM-REF-06A` | `BLOCKED` por `05B`                                                      | [ADM-REF-06A — Navegação administrativa por áreas](tasks/06-admin-competicoes-equipes/ADM-REF-06A.md)         |
|    28 | `ADM-REF-06B` | `BLOCKED` por `06A`                                                      | [ADM-REF-06B — Accordion acessível de equipes](tasks/06-admin-competicoes-equipes/ADM-REF-06B.md)             |
|    29 | `ADM-REF-06C` | `BLOCKED` por `06B`                                                      | [ADM-REF-06C — Política transacional de remoção/retirada](tasks/06-admin-competicoes-equipes/ADM-REF-06C.md)  |
|    30 | `ADM-REF-06D` | `BLOCKED` por `06B` e `06C`                                              | [ADM-REF-06D — UI de remoção/retirada](tasks/06-admin-competicoes-equipes/ADM-REF-06D.md)                     |
|    31 | `ADM-REF-07A` | `BLOCKED` por `06D`                                                      | [ADM-REF-07A — Templates e revisões imutáveis](tasks/07-regulamento-progressao/ADM-REF-07A.md)                |
|    32 | `ADM-REF-07B` | `BLOCKED` por `07A`                                                      | [ADM-REF-07B — Trilhas, etapas, grupos e rodadas](tasks/07-regulamento-progressao/ADM-REF-07B.md)             |
|    33 | `ADM-REF-07C` | `BLOCKED` por `07B`                                                      | [ADM-REF-07C — Vagas, confrontos e contrato de partidas](tasks/07-regulamento-progressao/ADM-REF-07C.md)      |
|    34 | `ADM-REF-07D` | `BLOCKED` por `07C`                                                      | [ADM-REF-07D — Compilar, validar e ativar regulamento](tasks/07-regulamento-progressao/ADM-REF-07D.md)        |
|    35 | `ADM-REF-07E` | `BLOCKED` por `07D`                                                      | [ADM-REF-07E — Clonagem de template/edição anterior](tasks/07-regulamento-progressao/ADM-REF-07E.md)          |
|    36 | `ADM-REF-06E` | `BLOCKED` por `07E`                                                      | [ADM-REF-06E — Criação transacional de edição](tasks/06-admin-competicoes-equipes/ADM-REF-06E.md)             |
|    37 | `ADM-REF-06F` | `BLOCKED` por `06E`                                                      | [ADM-REF-06F — Wizard de criação de edição](tasks/06-admin-competicoes-equipes/ADM-REF-06F.md)                |
|    38 | `ADM-REF-07F` | `BLOCKED` por `06F` e `07D`                                              | [ADM-REF-07F — Editor estrutural do regulamento](tasks/07-regulamento-progressao/ADM-REF-07F.md)              |
|    39 | `ADM-REF-07G` | `BLOCKED` por `07F`                                                      | [ADM-REF-07G — Agendamento de partidas](tasks/07-regulamento-progressao/ADM-REF-07G.md)                       |
|    40 | `ADM-REF-07H` | `BLOCKED` por `07G` e `03D`                                              | [ADM-REF-07H — Validação e progressão de confronto](tasks/07-regulamento-progressao/ADM-REF-07H.md)           |
|    41 | `ADM-REF-07I` | `BLOCKED` por `07H`                                                      | [ADM-REF-07I — Encerramento de classificatória/grupos](tasks/07-regulamento-progressao/ADM-REF-07I.md)        |
|    42 | `ADM-REF-07J` | `BLOCKED` por `07H`                                                      | [ADM-REF-07J — W.O., desistência e decisão administrativa](tasks/07-regulamento-progressao/ADM-REF-07J.md)    |
|    43 | `ADM-REF-07K` | `BLOCKED` por `07I` e `07J`                                              | [ADM-REF-07K — Correções e emendas](tasks/07-regulamento-progressao/ADM-REF-07K.md)                           |
|    44 | `ADM-REF-08A` | `BLOCKED` por `07K`                                                      | [ADM-REF-08A — Estados editoriais e RLS pública](tasks/08-publicacao-area-publica/ADM-REF-08A.md)             |
|    45 | `ADM-REF-08B` | `BLOCKED` por `08A`                                                      | [ADM-REF-08B — Resumo e regras temporais de publicação](tasks/08-publicacao-area-publica/ADM-REF-08B.md)      |
|    46 | `ADM-REF-08C` | `BLOCKED` por `08B`                                                      | [ADM-REF-08C — Revisão e publicação administrativa](tasks/08-publicacao-area-publica/ADM-REF-08C.md)          |
|    47 | `ADM-REF-08D` | `BLOCKED` por `08C`                                                      | [ADM-REF-08D — Área pública por estrutura esportiva](tasks/08-publicacao-area-publica/ADM-REF-08D.md)         |
|    48 | `ADM-REF-09A` | `BLOCKED` por `01H`, `02E`, `05B`, `06D` e `08D`                         | [ADM-REF-09A — Reconciliação e enforcement global](tasks/09-qa-fechamento/ADM-REF-09A.md)                     |
|    49 | `ADM-REF-09B` | `BLOCKED` por `09A`                                                      | [ADM-REF-09B — QA integral autenticado e público](tasks/09-qa-fechamento/ADM-REF-09B.md)                      |
|    50 | `ADM-REF-09C` | `BLOCKED` por `09B`                                                      | [ADM-REF-09C — Fechamento documental da PR draft](tasks/09-qa-fechamento/ADM-REF-09C.md)                      |
