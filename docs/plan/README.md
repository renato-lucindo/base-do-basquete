# Plano greenfield autônomo — Base do Basquete

## Finalidade

Este pacote substitui o plano de continuidade por um plano de reconstrução integral. Não existe dependência do repositório antigo, de checkout anterior ou de infraestrutura local persistente.

## Identidade definida

- Nome público: **Base do Basquete**.
- Domínio próprio: **a definir posteriormente pelo responsável do projeto**.
- Não pesquisar, registrar, comprar ou configurar domínio próprio durante este plano sem nova definição.

A implementação deve ser conduzida autonomamente pela IDE, do repositório vazio até a publicação, usando:

- GitHub como fonte da verdade para código, documentação, histórico e CI;
- Cloudflare Workers para preview e produção;
- Supabase para PostgreSQL, Auth e Storage;
- navegador autorizado nos ambientes GitHub, Cloudflare e Supabase quando a ação não possuir API, CLI ou conector disponível.

## Ordem de leitura obrigatória

Antes da implementação, colocar `AGENTS.md` e `HANDOFF.md` na raiz do novo repositório. Em seguida, ler:

1. `AGENTS.md`
2. `HANDOFF.md`
3. `PLANO-MESTRE-PR-FONTES-DE-DADOS-E-JOGADORES.md`
4. `PROMPT-MESTRE-IDE.md`
5. `POLITICA-AUTONOMIA-CLOUD.md`
6. `ARQUITETURA-SEGURANCA.md`
7. `REQUISITOS-FUNCIONAIS.md`
8. `MODELO-BOXSCORE-FIBA.md`
9. `MODELO-BOXSCORE-SITE.md`
10. `PLANO-EXECUCAO.md`
11. `MATRIZ-RASTREABILIDADE.md`
12. `FUTURO-OCR.md`

O texto que inicia a primeira tarefa está em `PROMPT-PARA-EXECUCAO.md`.

## Regra de execução

Executar os pacotes de trabalho de `PLANO-EXECUCAO.md` na ordem de dependência. Cada pacote representa uma entrega vertical completa e pode envolver banco, backend, interface, testes e deploy no mesmo PR.

## Proposta de governança documental

O plano para classificar fontes, explicitar precedência, reduzir o `HANDOFF.md`, tratar duplicatas e introduzir verificações automáticas está em `PLANO-GOVERNANCA-DOCUMENTAL.md`. Enquanto estiver marcado como proposta, ele não altera a autoridade nem o estado dos documentos existentes.

O catálogo inicial da auditoria está em `../governance/DOCUMENT-CATALOG.md`. Itens marcados como `classificação pendente` são conflitos a resolver; não representam uma mudança silenciosa de autoridade.

Não pedir confirmação para decisões técnicas reversíveis cobertas por este plano. Aplicar os padrões definidos, registrar a decisão e continuar.

Solicitar intervenção humana somente quando houver bloqueio real que não possa ser resolvido por ferramenta, como login interativo, MFA, CAPTCHA, aquisição paga, comprovação de domínio ou ação irreversível sobre dados de produção.

## Validação simplificada

- Não criar uma etapa de validação separada para cada pequeno arquivo ou função.
- Executar um único gate automático ao final de cada pacote de trabalho.
- O gate reúne lint, typecheck, testes relevantes, build, verificações de segurança e deploy de preview quando aplicável.
- Corrigir falhas automaticamente e repetir o gate até três vezes antes de declarar bloqueio.
- Não pedir ao usuário para confirmar decisões que possam ser verificadas por testes, documentação oficial, logs ou preview.

## Persistência remota

Nenhum artefato importante pode existir somente na máquina ou workspace temporário. Código, migrations, configuração declarativa, documentação e evidências devem ser enviados ao GitHub. Segredos devem existir apenas nos cofres do GitHub, Cloudflare ou Supabase.

O workspace da IDE pode ser usado de forma efêmera para gerar arquivos e executar ferramentas, mas nunca será fonte da verdade nem requisito operacional do produto.

## Plano anterior

O conteúdo de `referencias/plano-original/` é apenas um catálogo detalhado de requisitos e decisões históricas. A baseline bloqueada e as 156 tarefas antigas não devem ser executadas individualmente.

## Resultado esperado

Ao concluir o plano devem existir:

- repositório privado no GitHub;
- CI funcional e proteção contra vazamento de segredos;
- ambientes de preview/staging e produção;
- aplicação full-stack publicada no Cloudflare;
- banco, autenticação e storage configurados no Supabase;
- painel protegido por MFA para uma única conta administrativa, sem cadastro ou gestão de usuários;
- site público contextual;
- inscrições, elencos, jogos, súmula manual, estatísticas e importação de boxscore em PDF;
- observabilidade, auditoria e processo seguro de release.


## Plano ativo de melhorias — 24/08/2026

A evolução posterior ao WP-14 está definida em `improvements/PLANO-DE-IMPLEMENTACAO-E-DIVISAO-DAS-PRS.md`, com sete PRs sequenciais. Os requisitos normativos que sustentam esse plano estão no mesmo diretório.

O primeiro pacote é o WP-15, correspondente à PR 1 de fundação de dados, privacidade e read models. Nenhuma PR desse ciclo autoriza merge ou deploy de produção sem os gates e a aprovação humana definidos no plano.

## Plano mestre da PR #35 — 27/08/2026

O plano ativo para continuar a PR draft #35 está em `PLANO-MESTRE-PR-FONTES-DE-DADOS-E-JOGADORES.md`. Ele consolida a refatoração administrativa, o naipe obrigatório, o sexo privado do atleta, o perfil versionado de dados, a separação entre jogo e submissões e os dois desenhos públicos de jogadores.

Executar os Pacotes 0 a 9 na ordem e pelos checkpoints definidos nesse documento. Os documentos anteriores e o plano de melhorias permanecem como referência complementar quando não conflitarem com o plano mestre. Merge e produção continuam dependentes de autorização explícita.

## Entrada operacional retomável — PR #35

Para executar o plano sem misturar features nem perder contexto entre sessões, usar `tasks-pr35/README.md` como índice operacional. O plano mestre continua normativo; esse diretório divide seus Pacotes 0 a 9 em arquivos de tasks atômicas, com dependências, escopo negativo, gates e handoff. `PLANO-TASKS-RETOMAVEIS-PR35.md` fica preservado somente como visão consolidada.

Ordem mínima para cada continuação da PR #35:

1. `AGENTS.md`;
2. `HANDOFF.md`;
3. este `README.md`;
4. regras globais e arquivo da task atual em `tasks-pr35/`;
5. seções citadas do `PLANO-MESTRE-PR-FONTES-DE-DADOS-E-JOGADORES.md`;
6. demais documentos somente quando o cartão apontar dependência ou houver conflito de decisão.

Somente uma task pode permanecer em `DOING`. Migrations já enviadas ou aplicadas são imutáveis e qualquer correção deve usar nova migration.

## Plano acelerado do MVP — 03/09/2026

Por decisão do responsável, a fila operacional ativa da PR #35 passou a ser `acelerado-mvp/README.md`. Os 50 cartões permanecem rastreados em `tasks-pr35/`, mas agora funcionam como requisitos internos de 5 pacotes verticais de MVP e 4 pacotes pós-MVP, sem CI, preview e handoff separados por cartão.

O pacote ativo é `MVP-01 — Jogo estrutural e ingestão principal`. O MVP prioriza o fluxo completo e seguro de criação, equipes/elencos, estrutura, agenda, súmula ou boxscore PDF de contrato versionado, publicação explícita e consulta pública. Funcionalidades adiadas continuam obrigatoriamente mapeadas em `POST-01` a `POST-04`.
