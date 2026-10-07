# Catálogo documental inicial

**Estado:** catálogo operacional em implantação
**Unidade:** `DOC-GOV-02`
**Atualizado em:** 2026-10-06

## Finalidade

Este catálogo identifica as fontes principais do repositório e os conflitos que precisam ser resolvidos antes da adoção integral do plano de governança. Ele não reclassifica silenciosamente documentos existentes nem substitui seu conteúdo.

## Fontes correntes sem conflito identificado

| Assunto | Fonte | Papel observado | Estado inicial |
| --- | --- | --- | --- |
| Regras permanentes do repositório | `AGENTS.md` | Segurança, execução, Git, acessibilidade e continuidade | vigente |
| Coordenação dos agentes | `.agents/agent-contract.md` | Write lock, review packet e validade dos pareceres | vigente |
| Perfil de referências | `docs/governance/STANDARDS-PROFILE.md` | Aplicação proporcional de ISO/IEC/IEEE 15289, 12207 e 26514 e práticas GitHub | proposta |
| Contribuição | `CONTRIBUTING.md` | Entrada operacional para colaboradores | vigente |
| Estado operacional | `HANDOFF.md` | Checkpoint corrente, riscos, mudanças locais e próximo passo | vigente; reduzido em `DOC-GOV-02`, QA pendente |
| Entrada do plano | `docs/plan/README.md` | Ordem de leitura e encaminhamento aos planos | vigente; governança em implantação |
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
| Task e evidência compartilham basename | Exemplos `ADM-REF-02A.md` em `tasks-pr35` e `docs/execution` | Busca e links ambíguos | Manter diretórios distintos e introduzir tipo/estado nos metadados; avaliar sufixos apenas em unidade futura |
| Arquitetura descrita diverge da árvore atual | Documento cita `app/contracts`, `app/domain` e `app/server`; implementação usa `app/modules` | Onboarding e barreiras inconsistentes | Registrar a estrutura real ou executar refatoração separada; não misturar com governança documental |

## Resolução registrada em DOC-GOV-02

O conflito “handoff mistura estado e histórico” foi tratado sem mover ou apagar evidências. O `HANDOFF.md` passa a conter somente o checkpoint operacional; o arquivo integral anterior permanece no histórico Git em `b663b7a:HANDOFF.md`, e os relatos fechados continuam em `docs/execution/`. A mudança só pode ser integrada após parecer válido de `qa-reviewer`.

## Inventário quantitativo inicial

O inventário pode ser reproduzido sem alterar arquivos:

```powershell
npm run docs:inventory
```

O comando inclui Markdown rastreado e não rastreado, respeita exclusões do Git e relata contagens, maiores arquivos, hashes duplicados e colisões de basename. A baseline reproduzível no checkout limpo de `DOC-GOV-01`, antes da correção dos achados de revisão, registrou:

- 326 documentos Markdown, todos rastreados;
- nenhuma duplicata exata;
- colisões de basename entre índices, prompts e pares task/evidência, com os caminhos completos emitidos pelo comando;
- `HANDOFF.md` com mais de 500 linhas, confirmando a necessidade de redução em unidade própria.

Arquivos não rastreados observados em outro workspace são deliberadamente excluídos desta baseline e não fundamentam classificação, autoridade ou remoção. Caso continuem existindo, devem ser redescobertos e atribuídos no workspace de origem antes de qualquer decisão.

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
