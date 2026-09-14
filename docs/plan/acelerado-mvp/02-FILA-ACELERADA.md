# Fila acelerada

## Trilha MVP

| Ordem | Pacote | Conteúdo | Janelas alvo | Estado inicial |
| ---: | --- | --- | ---: | --- |
| 1 | `MVP-01` | Jogo estrutural e ingestão principal | 1–2 | `DONE` |
| 2 | `MVP-02` | Jogadores públicos e estabilidade boxscore | 1 | `DONE` |
| 3 | `MVP-03` | Administração e criação por presets | 1–2 | `DONE` |
| 4 | `MVP-04` | Agendamento, progressão básica e publicação | 1–2 | `DONE` |
| 5 | `MVP-05` | QA, release candidata e handoff | 1–2 | `DONE` |

Depois de `MVP-01`, `MVP-02` e `MVP-03` são conceitualmente independentes, mas podem ser executados serialmente na mesma branch quando não houver execução paralela disponível.

## Trilha pós-MVP

| Ordem | Pacote | Conteúdo | Estado inicial |
| ---: | --- | --- | --- |
| 6 | `POST-01` | Fallback, suplemento, conflitos e projeção rara | `DOING` |
| 7 | `POST-02` | Retirada, clonagem e editor estrutural completo | após MVP |
| 8 | `POST-03` | Fechamento de grupos, W.O. e emendas | após `POST-02` |
| 9 | `POST-04` | Enforcement e fechamento integral | após filas humanas e pacotes anteriores |

## Política de retomada

- Existe apenas um pacote em escrita.
- Os cartões originais dentro do pacote são checklists internos, não gates independentes.
- Faça commits por unidade funcional coerente, mas aguarde o final do pacote para o ciclo completo de CI/preview.
- Falha de gate retorna ao menor commit produtor dentro do mesmo pacote; não cria um novo cartão.
- Se uma parte pós-MVP bloquear o caminho crítico, entregue um estado explícito de revisão/bloqueio e continue o MVP.
