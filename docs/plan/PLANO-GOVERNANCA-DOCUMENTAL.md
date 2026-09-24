# Plano de governança documental

**Estado:** proposta para adoção
**Escopo:** documentação versionada do projeto
**Responsável operacional:** `project-maintainer`
**Aprovação necessária:** responsável pelo produto e `qa-reviewer`

## 1. Objetivo

Estabelecer uma única forma de localizar, interpretar, atualizar e substituir documentos do projeto, reduzindo duplicação e conflito sem concentrar toda a especificação em um `spec.md` monolítico.

Ao final da implantação:

- cada documento terá finalidade, autoridade, estado e responsável identificáveis;
- haverá um único índice normativo para descobrir os documentos vigentes;
- precedência e substituição serão explícitas;
- histórico e evidências permanecerão preservados sem competir com instruções atuais;
- documentos duplicados ou obsoletos não serão usados acidentalmente como fonte vigente;
- nenhuma decisão essencial dependerá apenas de conversa, workspace local ou arquivo não indexado.

## 2. Problemas que o plano resolve

1. O índice atual registra sucessivos planos ativos sem apresentar uma visão única do estado de cada um.
2. O `HANDOFF.md` contém estado corrente e grande volume de histórico operacional, dificultando localizar o próximo passo autoritativo.
3. Existem documentos iguais ou quase iguais em locais diferentes.
4. Planos, requisitos, decisões, evidências e instruções operacionais nem sempre são distinguíveis apenas pelo nome ou diretório.
5. A precedência está definida em alguns documentos, mas não existe um registro central que cubra toda a documentação.
6. Não há verificação automática para links quebrados, metadados ausentes, duplicatas ou referências a documentos substituídos.

## 3. Princípios

- **Uma autoridade por assunto:** pode haver documentos complementares, mas somente um deve ser normativo para cada decisão ou escopo.
- **Índice, não duplicação:** o índice aponta para as fontes; não republica seu conteúdo.
- **Histórico imutável:** evidências de execução e ADRs aceitos não são reescritos para representar o presente.
- **Substituição explícita:** documento superado indica seu sucessor e deixa de orientar novas mudanças.
- **Mudança proporcional:** alteração de texto editorial simples não exige o mesmo processo de uma mudança de requisito, segurança ou release.
- **Preservação antes de limpeza:** nenhuma duplicata é removida até que origem, autoridade, referências e diferenças sejam verificadas.
- **Git como fonte da verdade:** documento essencial precisa estar versionado e indexado.
- **Sem `spec.md` global por padrão:** especificações permanecem modulares. Um `SPEC-*.md` só é criado para um contrato ou unidade delimitada que não esteja coberta pelas fontes existentes.

## 4. Classes documentais

| Classe | Finalidade | Local preferencial | Mutabilidade |
| --- | --- | --- | --- |
| Entrada | Apresentar o projeto e encaminhar para as fontes vigentes | `README.md`, `docs/plan/README.md` | Atualizável |
| Governança | Definir como agentes, documentação, revisão e release operam | `AGENTS.md`, `.agents/`, `docs/governance/` | Controlada |
| Requisito | Definir comportamento, restrições e critérios de produto | `docs/requirements/` | Versionada |
| Arquitetura | Definir fronteiras e decisões técnicas vigentes | `docs/architecture/` | Versionada |
| ADR | Registrar uma decisão arquitetural e suas consequências | `docs/decisions/` | Imutável após aceitação; nova ADR substitui |
| Plano | Definir sequência futura, dependências e gates | `docs/plan/` | Atualizável enquanto ativo |
| Unidade de trabalho | Delimitar objetivo, escopo, aceite e escopo negativo | PR e, quando necessário, `docs/work/` | Encerrada ao concluir |
| Evidência | Registrar o que foi realmente executado e validado | `docs/execution/` | Imutável após fechamento, salvo correção factual registrada |
| Operação | Explicar uso, manutenção, incidente e recuperação | `docs/runbooks/`, manuais em `docs/` | Atualizável |
| Referência histórica | Preservar material substituído sem autoridade corrente | `docs/archive/` ou diretório histórico já identificado | Imutável |

A reorganização física dos diretórios é opcional e posterior. A primeira implantação classifica o conteúdo no índice sem mover arquivos, evitando quebra massiva de links.

## 5. Estados do ciclo de vida

Todo documento normativo ou de planejamento deve ter um dos estados abaixo:

- `draft`: proposta ainda não aprovada;
- `active`: fonte vigente dentro do escopo declarado;
- `frozen`: versão usada por uma release ou baseline, sem novas alterações funcionais;
- `superseded`: substituído integralmente por outro documento;
- `historical`: preservado somente como contexto ou evidência;
- `archived`: retirado da navegação normal, mas mantido no Git.

Regras:

1. Apenas `active` pode introduzir obrigação vigente.
2. `draft` não substitui documento ativo.
3. `superseded` deve informar `superseded_by`.
4. `frozen` recebe correção apenas factual; mudança de decisão exige nova versão ou novo documento.
5. `historical` e `archived` não podem ser citados como instrução atual sem indicação explícita de que servem apenas como referência.

## 6. Metadados mínimos

Documentos normativos novos devem começar com front matter equivalente a:

```yaml
---
title: Nome legível
document_id: REQ-001
document_type: requirement
status: active
owner: project-maintainer
approved_by: product-owner
effective_from: 2026-09-24
last_reviewed: 2026-09-24
scope: Descrição curta do alcance
supersedes: []
superseded_by: null
related: []
---
```

O identificador é estável e não depende do caminho. Documentos existentes recebem metadados progressivamente; a implantação não exige reescrever todos em uma única PR.

Campos obrigatórios na primeira fase:

- `document_type`;
- `status`;
- `owner`;
- `scope`;
- `supersedes` ou `superseded_by` quando aplicável.

Datas, aprovadores e relações passam a ser obrigatórios para documentos criados depois da adoção.

## 7. Precedência

Em caso de conflito, aplicar esta ordem:

1. instrução explícita mais recente do responsável pelo produto, depois de registrada no repositório;
2. `AGENTS.md` e contrato operacional dos agentes para processo, segurança e coordenação;
3. requisitos e políticas `active` indicados no índice normativo;
4. ADRs aceitos para decisões arquiteturais dentro de seu escopo;
5. plano ativo da unidade ou ciclo;
6. contrato e critérios de aceite da unidade de trabalho/PR;
7. `HANDOFF.md` para estado operacional corrente;
8. documentação de execução e runbooks;
9. documentos `frozen`, `historical`, `superseded` ou `archived`, apenas como referência.

Uma fonte inferior não pode alterar silenciosamente uma superior. Quando uma decisão nova superar requisito ou arquitetura vigente, a mesma unidade deve atualizar a fonte superior correspondente ou registrar formalmente a substituição.

## 8. Índice normativo único

`docs/plan/README.md` continuará sendo a porta de entrada durante a transição. Ele deverá conter uma tabela única, sem copiar o conteúdo dos documentos:

| Assunto | Documento autoritativo | Estado | Escopo | Substitui | Próxima revisão |
| --- | --- | --- | --- | --- | --- |

O índice terá cinco blocos:

1. regras permanentes;
2. requisitos e arquitetura vigentes;
3. plano/ciclo ativo;
4. unidade operacional atual;
5. documentos congelados, substituídos e históricos.

Somente o índice declara qual plano está ativo. Documentos podem descrever sua própria precedência local, mas não podem se autodeclarar globalmente ativos sem estarem registrados no índice.

## 9. Papel de cada fonte principal

- `README.md`: apresentação curta e links; não contém especificação detalhada.
- `AGENTS.md`: regras permanentes de atuação e segurança.
- `docs/plan/README.md`: catálogo normativo e resolução de precedência.
- requisitos funcionais: comportamento esperado e escopo de produto.
- arquitetura e ADRs: decisões técnicas e suas justificativas.
- planos: trabalho futuro e ordem de execução.
- PR/unidade: alteração delimitada, aceite e evidências do delta.
- `HANDOFF.md`: somente estado corrente, riscos, divergências, mudanças não commitadas e próximo passo exato.
- `docs/execution/`: registro fechado do que aconteceu; não serve como backlog.

## 10. Política específica do `HANDOFF.md`

O handoff deve permanecer pequeno e operacional. Estrutura proposta:

1. objetivo vigente;
2. unidade ativa e `WRITE_LOCK`;
3. branch, PR, base e `HEAD`;
4. estado dos serviços e ambientes;
5. mudanças não commitadas;
6. testes e evidências ainda válidos;
7. riscos e bloqueios;
8. próximo passo exato;
9. links para evidências históricas.

Ao fechar uma unidade, o relato detalhado migra para `docs/execution/` ou para a PR. O handoff preserva apenas um resumo e o link. Histórico anterior não será apagado até ser extraído e reconciliado.

Meta inicial: conteúdo corrente legível em menos de 200 linhas, sem perder informação essencial.

## 11. Criação, alteração e encerramento

### Documento novo

Antes de criar:

1. pesquisar documento equivalente;
2. verificar se a mudança cabe em fonte existente;
3. definir tipo, escopo, owner e estado;
4. registrar no índice se for normativo;
5. indicar documentos relacionados ou substituídos.

### Alteração

- Correção editorial: revisão normal, sem mudar decisão.
- Mudança de requisito, arquitetura, segurança, banco, workflow, governança ou release: critérios de aceite explícitos e `qa-reviewer`; incluir revisor de banco/segurança quando o domínio exigir.
- Evidência fechada: não reescrever resultado; anexar correção factual datada.
- ADR aceita: criar nova ADR quando a decisão mudar.

### Encerramento ou substituição

1. criar ou atualizar a fonte sucessora;
2. marcar a anterior como `superseded`;
3. registrar links nos dois sentidos;
4. atualizar o índice e referências ativas;
5. executar verificação de links;
6. mover para arquivo somente em uma unidade posterior e não destrutiva.

## 12. Política de especificações

Não será criado um `spec.md` global. Uma especificação delimitada, nomeada `SPEC-<ASSUNTO>.md`, só se justifica quando todos os critérios forem atendidos:

- existe um contrato funcional ou técnico independente;
- o assunto atravessa mais de uma camada ou pacote;
- requisitos e critérios de aceite não cabem claramente em documento vigente;
- há responsável e ciclo de vida definidos;
- o índice identifica a especificação como autoridade daquele assunto;
- não duplica ADR, contrato de API, migration, requisito ou plano existente.

Templates de PR ou cartões de trabalho não são especificações permanentes.

## 13. Controles automatizados propostos

Adicionar gradualmente um job documental ao gate para verificar:

- links Markdown locais quebrados;
- IDs documentais duplicados;
- documentos normativos sem metadados mínimos;
- `superseded_by` inexistente ou sem relação inversa;
- mais de um documento `active` para o mesmo escopo exclusivo;
- arquivos idênticos por hash fora de diretórios históricos;
- termos proibidos como segredo ou credencial em exemplos;
- referências ativas a documentos arquivados ou substituídos;
- existência de próximo passo exato quando houver unidade ativa.

O job começa em modo relatório. Só se torna bloqueante depois que o baseline estiver classificado e as exceções legítimas forem documentadas.

## 14. Plano de implantação

### Fase 0 — Baseline e congelamento de limpeza

**Objetivo:** conhecer o acervo antes de mover ou remover qualquer arquivo.

Entregas:

- inventário de Markdown com caminho, hash, tamanho e links recebidos/emitidos;
- identificação de arquivos não rastreados e origem provável;
- lista de duplicatas exatas e divergentes;
- registro de documentos que se declaram ativos;
- nenhuma exclusão, movimentação ou renomeação.

Aceite:

- inventário reproduzível;
- todas as duplicatas candidatas listadas;
- worktree preexistente preservada.

### Fase 1 — Catálogo e autoridade

**Objetivo:** tornar explícito o que é vigente sem reorganizar caminhos.

Entregas:

- tabela normativa em `docs/plan/README.md`;
- classificação dos documentos principais;
- regra central de precedência;
- sucessores registrados para planos claramente superados;
- distinção entre plano, requisito, evidência e histórico.

Aceite:

- um agente novo identifica em até cinco minutos as fontes vigentes e a unidade atual;
- nenhum assunto principal possui duas autoridades ativas sem delimitação de escopo.

### Fase 2 — Handoff operacional

**Objetivo:** separar estado corrente de histórico.

Entregas:

- novo formato do `HANDOFF.md`;
- extração do histórico fechado para documentos de execução ou índice histórico;
- links preservando todas as evidências relevantes;
- `WRITE_LOCK` e próximo passo inequívocos.

Aceite:

- handoff contém somente fatos necessários para retomada;
- todo conteúdo removido do handoff continua acessível no Git ou em evidência versionada.

### Fase 3 — Deduplicação segura

**Objetivo:** eliminar competição entre cópias sem perder conteúdo.

Entregas:

- comparação semântica das duplicatas;
- escolha documentada da cópia autoritativa;
- atualização dos links;
- marcação das demais como substituídas ou movimentação para histórico;
- remoção somente quando identidade e ausência de referências estiverem comprovadas.

Aceite:

- nenhuma duplicata exata permanece fora de áreas históricas justificadas;
- nenhuma referência quebrada;
- `git diff` permite auditar cada consolidação.

### Fase 4 — Metadados progressivos

**Objetivo:** aplicar o ciclo de vida a documentos normativos e novos documentos.

Entregas:

- front matter nos documentos de maior autoridade;
- IDs estáveis;
- owner, estado, escopo e relações de substituição;
- template para novos documentos.

Aceite:

- 100% das fontes listadas como normativas possuem metadados mínimos;
- documentos novos falham no gate se omitirem os campos obrigatórios.

### Fase 5 — Automação e manutenção contínua

**Objetivo:** impedir regressão documental.

Entregas:

- verificador documental em modo relatório;
- correção do baseline;
- ativação gradual das regras bloqueantes;
- revisão trimestral ou ao fechar cada ciclo de produto;
- relatório curto de documentos sem revisão recente.

Aceite:

- CI detecta links quebrados, IDs duplicados e conflitos básicos de ciclo de vida;
- revisão periódica tem owner e próximo vencimento registrados.

## 15. Unidades de trabalho recomendadas

Não executar toda a implantação em uma única PR. Sequência recomendada:

1. `DOC-GOV-01`: inventário, catálogo e precedência, sem mover arquivos;
2. `DOC-GOV-02`: redução do handoff e extração do histórico;
3. `DOC-GOV-03`: deduplicação e atualização de links;
4. `DOC-GOV-04`: metadados e template;
5. `DOC-GOV-05`: verificador documental e CI inicialmente não bloqueante;
6. `DOC-GOV-06`: correção do baseline e ativação seletiva do gate.

Cada unidade deve declarar escopo negativo, arquivos permitidos, critérios de aceite, reversibilidade e `REVIEW_PACKET` próprio.

## 16. Responsabilidades

| Papel | Responsabilidade |
| --- | --- |
| Responsável pelo produto | Aprovar mudanças de autoridade, escopo e precedência de produto |
| `project-maintainer` | Manter índice, metadados, links, handoff e implementação dos controles |
| `qa-reviewer` | Revisar mudanças de governança e validar que a retomada permanece inequívoca |
| `database-security-reviewer` | Revisar apenas documentação que altere contratos de banco, segurança de dados ou gates correlatos |
| Autor da unidade | Atualizar documentos afetados e declarar substituições no mesmo delta |

## 17. Métricas

Medir no início e após cada fase:

- documentos Markdown totais e normativos;
- duplicatas exatas e divergentes;
- links quebrados;
- documentos ativos sem owner ou escopo;
- conflitos de autoridade abertos;
- linhas do `HANDOFF.md`;
- tempo necessário para um agente localizar fontes vigentes e próximo passo;
- exceções temporárias do gate documental.

As métricas orientam manutenção; não justificam apagar evidência útil apenas para reduzir contagem.

## 18. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Perder contexto ao reduzir o handoff | Extrair primeiro, comparar links e só depois remover do arquivo corrente |
| Quebrar links ao mover documentos | Classificar sem mover na Fase 1; verificar links antes de cada movimentação |
| Criar burocracia excessiva | Metadados mínimos e revisão proporcional ao risco |
| Transformar o índice em nova cópia da especificação | Limitar o índice a catálogo, estado, escopo e precedência |
| Confundir plano proposto com regra vigente | Manter este documento como `proposta para adoção` até aprovação e implantação da Fase 1 |
| Apagar trabalho local não rastreado | Inventariar e atribuir origem antes de qualquer deduplicação |

## 19. Critérios de conclusão

A governança estará implantada quando:

- existir um único índice normativo;
- todas as fontes vigentes principais estiverem classificadas;
- precedência e substituição forem verificáveis;
- o handoff contiver apenas estado operacional atual;
- duplicatas conhecidas estiverem resolvidas ou justificadas;
- documentos normativos tiverem metadados mínimos;
- o gate documental bloquear regressões já saneadas;
- a documentação permitir a retomada sem contexto da conversa.

## 20. Escopo negativo

Este plano não autoriza:

- excluir ou mover documentos na mesma unidade que adota a governança;
- alterar requisitos de produto, arquitetura, segurança ou release;
- reescrever evidências históricas;
- limpar arquivos não rastreados sem identificar sua origem;
- criar um `spec.md` global;
- modificar código, banco, ambientes cloud ou produção;
- fazer merge sem o parecer exigido para mudança de governança.

## 21. Próximo passo exato

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: docs/plan/README.md e inventário Markdown do repositório
ACAO: abrir DOC-GOV-01, gerar inventário somente leitura e propor a tabela de autoridade sem mover ou excluir arquivos
CRITERIO_DE_CONCLUSAO: inventário reproduzível, fontes principais classificadas, conflitos de autoridade enumerados e diff limitado à documentação de governança
```
