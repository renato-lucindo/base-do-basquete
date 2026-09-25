# Perfil de aplicação das referências de governança

**Estado:** proposta para adoção
**Unidade:** `DOC-GOV-01`
**Atualizado em:** 2026-09-25
**Escopo:** ciclo de vida, documentação técnica, informação para usuários e saúde do repositório

## 1. Objetivo

Traduzir as referências escolhidas pelo responsável pelo produto em práticas verificáveis e proporcionais à Base do Basquete. Este perfil define o que será adotado, onde ficará a evidência e quais pontos ainda dependem de decisão ou de acesso ao texto integral das normas.

## 2. Referências adotadas

| Referência | Edição usada | Aplicação no projeto |
| --- | --- | --- |
| ISO/IEC/IEEE 15289 | 2019 | Tipos, finalidade, conteúdo, manutenção e relacionamento dos itens de informação do ciclo de vida |
| ISO/IEC/IEEE 12207 | 2026 | Estrutura dos processos do ciclo de vida de software, aplicada de forma iterativa e proporcional |
| ISO/IEC/IEEE 26514 | 2022 | Planejamento, desenho, desenvolvimento e manutenção da informação destinada aos usuários |
| GitHub Community Standards e GitHub Docs | versão corrente | Arquivos de saúde do repositório, contribuição, segurança, templates, ownership e proteção do fluxo de mudanças |

Fontes oficiais:

- <https://www.iso.org/standard/74909.html>
- <https://www.iso.org/standard/90219.html>
- <https://www.iso.org/standard/77451.html>
- <https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories>
- <https://docs.github.com/en/pull-requests/reference/managing-and-standardizing-pull-requests>

## 3. Declaração de alinhamento

O projeto declara **alinhamento orientado por estas referências**, e não certificação nem conformidade integral.

Motivos:

- as normas ISO são protegidas e o texto integral não está versionado no repositório;
- este perfil usa somente informações oficiais públicas e decisões explícitas do projeto;
- conformidade formal exigiria acesso autorizado às normas completas, matriz cláusula a cláusula, auditoria independente e tratamento documentado de todas as não conformidades;
- o GitHub Community Profile é direcionado principalmente a repositórios públicos, enquanto este projeto permanece privado.

Nenhum documento ou badge pode afirmar “certificado”, “conforme integralmente” ou equivalente sem uma avaliação formal posterior.

## 4. Estados de aplicação

- `adopted`: prática implementada e com evidência verificável;
- `partial`: prática existente, mas incompleta ou sem controle automático;
- `planned`: aprovada para unidade futura, ainda sem evidência suficiente;
- `not_applicable`: avaliada e dispensada com justificativa;
- `decision_required`: depende de escolha explícita do responsável pelo produto.

## 5. Perfil ISO/IEC/IEEE 12207:2026

A aplicação é iterativa: cada unidade de trabalho percorre definição, implementação, verificação, entrega e manutenção sem exigir um modelo cascata.

| Área do ciclo de vida | Aplicação no repositório | Evidência principal | Estado |
| --- | --- | --- | --- |
| Definição das necessidades | Requisitos, escopo, critérios de aceite e escopo negativo | `docs/plan/REQUISITOS-FUNCIONAIS.md`, plano ativo e PR | partial |
| Planejamento | Pacotes verticais, dependências, riscos, responsáveis e gates | `docs/plan/`, `HANDOFF.md`, `REVIEW_PACKET` | partial |
| Implementação | Branch/worktree por unidade, commits coerentes e backend autoritativo | Git, `AGENTS.md`, código e migrations | adopted |
| Verificação e validação | Testes focais, gate consolidado, revisão especializada, preview e smoke | CI, pgTAP, Vitest, Playwright, PR e `docs/execution/` | adopted |
| Transição e entrega | Merge protegido, versionamento, deploy e reconciliação | workflows, tags, runbooks e evidências de release | partial |
| Operação | Observabilidade, segurança, incidentes e rotinas administrativas | `docs/runbooks/`, `SECURITY.md`, logs redigidos | partial |
| Manutenção | Unidade curta, análise de impacto, regressão e documentação atualizada | PR, ADR, handoff e testes | partial |
| Retirada e descarte | Política de arquivamento, substituição e remoção segura | plano de governança documental | planned |
| Aquisição e fornecimento externo | Dependências, Supabase, Cloudflare e GitHub | lockfile, Dependabot, decisões e configuração declarativa | partial |
| Melhoria do processo | Métricas, retrospectiva documental e correção de baseline | catálogo, inventário e gates | planned |

## 6. Perfil ISO/IEC/IEEE 15289:2019

Os itens de informação são combinados de forma proporcional; não haverá um arquivo separado para cada item possível.

| Tipo de item de informação | Artefato no projeto | Regra |
| --- | --- | --- |
| Política | `AGENTS.md`, políticas de segurança e governança | Define obrigação permanente e owner |
| Plano | `docs/plan/` | Define trabalho futuro, dependências, riscos e aceite |
| Procedimento | `docs/runbooks/`, `CONTRIBUTING.md` | Fornece passos executáveis, pré-requisitos e recuperação |
| Relatório | `docs/execution/`, relatório de revisão | Registra resultado real, desvios e evidências |
| Registro | Git, PR, checks, logs redigidos, migrations e auditoria | Preserva evidência objetiva e data |
| Solicitação | Issue, PR ou instrução formal do responsável | Deve ser convertida em unidade com escopo verificável |
| Descrição | README, arquitetura, modelo de dados e manuais | Explica estado ou estrutura existente |
| Especificação | Requisitos, contratos versionados e `SPEC-*` delimitada | Define comportamento verificável sem duplicar outra autoridade |

Conteúdo mínimo dos documentos normativos:

- identificação e tipo;
- finalidade e audiência;
- escopo e exclusões;
- owner e aprovador;
- estado do ciclo de vida;
- entradas e documentos relacionados;
- conteúdo necessário à decisão ou execução;
- critérios de aceite ou validade;
- regras de manutenção, substituição e arquivamento.

## 7. Perfil ISO/IEC/IEEE 26514:2022

A norma será aplicada somente à informação destinada aos usuários da aplicação, não indiscriminadamente a ADRs, migrations ou evidências internas.

Documentos atuais e futuros abrangidos:

- `docs/PAINEL-ADMINISTRATIVO.md`;
- instruções operacionais apresentadas ao administrador;
- ajuda contextual de importação, súmula, publicação e segurança;
- futuros guias públicos ou administrativos.

Critérios para informação de usuário:

1. declarar audiência, objetivo e pré-requisitos;
2. organizar conteúdo pelas tarefas reais do usuário;
3. usar linguagem consistente com a interface;
4. apresentar passos, resultado esperado e recuperação de erros;
5. não expor detalhes internos ou dados sensíveis desnecessários;
6. oferecer navegação, títulos e estrutura pesquisável;
7. atender acessibilidade e formatos legíveis;
8. validar instruções contra a versão publicada da aplicação;
9. registrar versão, owner, última revisão e evento que exige atualização;
10. coletar limitações conhecidas e feedback observável.

Toda mudança de interface que torne instrução incorreta deve atualizar a informação de usuário na mesma unidade ou registrar bloqueio explícito de release.

## 8. Perfil GitHub Community Standards

Como o repositório é privado, os arquivos são adotados pelo valor operacional, e não para obter pontuação pública no Community Profile.

| Prática | Evidência | Estado | Próxima ação |
| --- | --- | --- | --- |
| README | `README.md` | partial | adicionar instalação, comandos, arquitetura e links de governança |
| Diretrizes de contribuição | `CONTRIBUTING.md` | adopted nesta unidade | validar após merge na branch padrão |
| Política de segurança | `SECURITY.md` | partial | documentar canal privado concreto e versões suportadas quando aplicável |
| Template de PR | `.github/pull_request_template.md` | adopted nesta unidade | validar preenchimento automático após merge |
| CODEOWNERS | `.github/CODEOWNERS` | adopted nesta unidade | habilitar review de code owner na proteção da `main` quando suportado pelo plano da conta |
| Proteção da branch | regras de `main` e checks obrigatórios | partial | reconciliar regras reais e documentar exceções do plano da conta |
| Issue templates | ausente | planned | criar somente se GitHub Issues for adotado como entrada operacional |
| Código de conduta | ausente | decision_required | decidir antes de colaboração externa ou abertura pública |
| Licença | ausente | decision_required | não escolher licença sem decisão de distribuição do responsável |
| Suporte | documentação administrativa e handoff | not_applicable no momento | reavaliar antes de usuários ou mantenedores externos |

O `CODEOWNERS` humano não substitui os pareceres especializados definidos em `.agents/`; ambos cobrem controles diferentes.

## 9. Matriz de rastreabilidade mínima

Cada unidade futura deve demonstrar, quando aplicável:

| Necessidade | Evidência esperada |
| --- | --- |
| Por que mudar | requisito, incidente, solicitação ou decisão identificada |
| O que mudar | objetivo, escopo, arquivos e serviços |
| O que não mudar | escopo negativo |
| Como construir | plano, arquitetura, procedimento ou decisão |
| Como verificar | testes e critérios de aceite |
| O que ocorreu | relatório/evidência de execução |
| Quem aprovou | PR, parecer e commit revisado |
| Como operar | manual, runbook ou indicação de não aplicabilidade |
| Como manter ou substituir | owner, estado e sucessor documental |

## 10. Revisão das referências

- revisar este perfil pelo menos uma vez por ano;
- revisar imediatamente quando a ISO publicar nova edição aplicável;
- acompanhar a revisão anunciada da ISO/IEC/IEEE 15289:2019;
- registrar edição e data, nunca apenas o número da norma;
- revisar práticas GitHub quando recursos, visibilidade ou plano da conta mudarem;
- não atualizar edição normativa silenciosamente: avaliar impacto e registrar decisão.

## 11. Próximas unidades

1. `DOC-GOV-02`: classificar e reduzir o handoff, preservando evidências;
2. `DOC-GOV-03`: reconciliar duplicatas e links;
3. `DOC-GOV-04`: aplicar metadados e conteúdo mínimo aos documentos normativos;
4. `DOC-USER-01`: auditar o manual administrativo pelos critérios de informação para usuários;
5. `REPO-HEALTH-01`: completar README e decidir uso de Issues, código de conduta e licença.

## 12. Próximo passo exato

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: qa-reviewer
ARQUIVO_OU_SERVICO: docs/governance/STANDARDS-PROFILE.md e delta da PR DOC-GOV-01
ACAO: verificar se o perfil é proporcional, rastreável e não declara conformidade ou certificação não demonstrada
CRITERIO_DE_CONCLUSAO: parecer vinculado ao HEAD, com referências, edições, estados de aplicação e dispensas coerentes
```
