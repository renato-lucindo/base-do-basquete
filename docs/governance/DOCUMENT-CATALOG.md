# Catálogo documental inicial

**Estado:** rascunho de auditoria
**Unidade:** `DOC-GOV-01`
**Atualizado em:** 2026-09-25

## Finalidade

Este catálogo identifica as fontes principais do repositório e os conflitos que precisam ser resolvidos antes da adoção integral do plano de governança. Ele não reclassifica silenciosamente documentos existentes nem substitui seu conteúdo.

## Fontes correntes sem conflito identificado

| Assunto | Fonte | Papel observado | Estado inicial |
| --- | --- | --- | --- |
| Regras permanentes do repositório | `AGENTS.md` | Segurança, execução, Git, acessibilidade e continuidade | vigente |
| Coordenação dos agentes | `.agents/agent-contract.md` | Write lock, review packet e validade dos pareceres | vigente |
| Perfil de referências | `docs/governance/STANDARDS-PROFILE.md` | Aplicação proporcional de ISO/IEC/IEEE 15289, 12207 e 26514 e práticas GitHub | proposta |
| Contribuição | `CONTRIBUTING.md` | Entrada operacional para colaboradores | proposta nesta unidade |
| Estado operacional | `HANDOFF.md` | Estado corrente, evidências e próximo passo | vigente; requer redução |
| Entrada do plano | `docs/plan/README.md` | Ordem de leitura e encaminhamento aos planos | vigente; requer consolidação |
| Requisitos de produto | `docs/plan/REQUISITOS-FUNCIONAIS.md` | Baseline funcional consolidada | vigente |
| Arquitetura e segurança | `docs/plan/ARQUITETURA-SEGURANCA.md` | Stack, fronteiras e controles obrigatórios | vigente; estrutura física requer reconciliação |
| Contrato FIBA | `docs/plan/MODELO-BOXSCORE-FIBA.md` | Formato versionado e critérios do parser FIBA | vigente |
| Contrato Basketball Site | `docs/plan/MODELO-BOXSCORE-SITE.md` | Formato versionado e critérios do parser próprio | vigente |
| Decisões arquiteturais | `docs/decisions/` | ADRs aceitas | histórico normativo por decisão |
| Evidências de execução | `docs/execution/` | Resultados reais de unidades fechadas | evidência; não é backlog |
| Operação | `docs/runbooks/` | Incidentes, recuperação e procedimentos | vigente |
| Plano original | `docs/plan/referencias/plano-original/` | Catálogo histórico detalhado | referência histórica |

## Conflitos de classificação abertos

| Conflito | Evidência | Risco | Tratamento proposto |
| --- | --- | --- | --- |
| Mais de um plano se declara ativo | `docs/plan/README.md` apresenta plano mestre, tasks retomáveis e plano acelerado em momentos sucessivos | Agente escolher fila antiga | Definir um único ciclo operacional ativo e marcar os demais como congelados ou históricos |
| Handoff mistura estado e histórico | `HANDOFF.md` concentra centenas de linhas de unidades concluídas | Próximo passo antigo ser interpretado como atual | Extrair histórico para `docs/execution/` e manter resumo com links |
| Planos de estatísticas aparecem em mais de um local no workspace principal | Arquivos na raiz e em `docs/plan/improvements/` | Commitar a cópia errada | Identificar origem, comparar conteúdo e escolher autoridade sem apagar antes da reconciliação |
| Task e evidência compartilham basename | Exemplos `ADM-REF-02A.md` em `tasks-pr35` e `docs/execution` | Busca e links ambíguos | Manter diretórios distintos e introduzir tipo/estado nos metadados; avaliar sufixos apenas em unidade futura |
| Arquitetura descrita diverge da árvore atual | Documento cita `app/contracts`, `app/domain` e `app/server`; implementação usa `app/modules` | Onboarding e barreiras inconsistentes | Registrar a estrutura real ou executar refatoração separada; não misturar com governança documental |

## Inventário quantitativo inicial

O inventário pode ser reproduzido sem alterar arquivos:

```powershell
npm run docs:inventory
```

O comando inclui Markdown rastreado e não rastreado, respeita exclusões do Git e relata contagens, maiores arquivos, hashes duplicados e colisões de basename. Valores observados no workspace principal no início de `DOC-GOV-01`:

- 330 documentos Markdown no workspace principal, incluindo 4 arquivos não rastreados;
- 267 documentos Markdown sob `docs/plan`;
- 165 arquivos sob `docs/plan/referencias`;
- 67 arquivos sob `docs/plan/tasks-pr35`;
- 41 arquivos sob `docs/execution`;
- `HANDOFF.md` com 576 linhas e aproximadamente 122 KB;
- uma duplicata exata conhecida de `PLANO-PERFIL-JOGADOR-SIMPLIFICADO.md` no workspace principal;
- duas variantes divergentes conhecidas de `PLANO-ESTATISTICAS-JOGADORES-END-TO-END.md` no workspace principal.

Os dois últimos itens pertencem ao workspace original e não foram copiados, movidos ou apagados nesta worktree.

## Regras durante a auditoria

1. Não mover, renomear ou excluir documento antes de mapear referências e origem.
2. Não transformar este catálogo em cópia dos requisitos.
3. Não declarar um plano substituído apenas por antiguidade; exigir sucessor verificável.
4. Não usar arquivo não rastreado como fonte normativa.
5. Registrar conflitos sem resolvê-los por inferência.
6. Preservar PDFs, migrations, evidências e ADRs fechadas.
7. Avaliar alinhamento pelas edições registradas no perfil; não declarar certificação sem auditoria formal.

## Próximo passo exato

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: documentos listados em "Conflitos de classificação abertos"
ACAO: gerar mapa de referências recebidas e emitidas, comparar as variantes e propor estados sem mover arquivos
CRITERIO_DE_CONCLUSAO: cada conflito possui autoridade proposta, sucessor verificável e lista de links a atualizar
```
