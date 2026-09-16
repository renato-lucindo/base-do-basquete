# Funcionalidades do painel administrativo

Este documento descreve o painel administrativo implementado na **Base do
Basquete**. Ele serve como visão funcional e guia de operação; não substitui os
runbooks técnicos de deploy, migração ou recuperação.

## Escopo e ambiente

O painel foi projetado para a primeira temporada com **uma única conta
administrativa**. As funcionalidades descritas abaixo estão no código atual e
nos previews das PRs já validadas. A produção permanece na versão estável
`v1.1.0` até que uma nova publicação seja executada pela branch principal ou por
versão marcada.

Todas as rotas administrativas usam o prefixo `/admin`. O host pode mudar entre
preview e produção, mas os caminhos relativos permanecem os mesmos.

## Acesso e segurança

- Login por e-mail e senha em `/admin/login`.
- Segundo fator TOTP obrigatório, com matrícula em `/admin/mfa/enroll` e
  confirmação em `/admin/mfa`.
- Operações administrativas exigem sessão `aal2` da conta singleton.
- Não há cadastro público, convite, múltiplos administradores, RBAC ou gestão de
  usuários.
- Formulários de escrita usam proteção de origem e CSRF.
- Autorização, validações, cálculos, transações e gravações são executados no
  backend e no PostgreSQL. O navegador não é tratado como fonte confiável.
- RLS, funções administrativas restritas e auditoria reforçam as permissões no
  banco.
- Dados privados de elegibilidade e PDFs não são publicados.
- A área `/admin/security` confirma a sessão AAL2 e permite encerrar todas as
  sessões.

## Navegação principal

O menu administrativo possui cinco áreas:

| Área | Caminho | Finalidade |
| --- | --- | --- |
| Competições | `/admin/competitions` | Criar e operar edições, equipes inscritas, jogos, dados e publicação. |
| Equipes | `/admin/teams` | Consultar e cadastrar equipes globais. |
| Atletas | `/admin/players` | Consultar, cadastrar e revisar dados privados de elegibilidade. |
| Pendências | `/admin/review-queues` | Acompanhar as revisões que bloqueiam o fechamento final. |
| Segurança | `/admin/security` | Conferir a sessão protegida e encerrar sessões. |

## Pendências de fechamento

Em `/admin/review-queues` é possível:

- visualizar as quantidades de competições sem naipe ou perfil final;
- visualizar a quantidade de atletas com elegibilidade pendente;
- abrir diretamente a revisão de cada competição;
- buscar atletas pelo nome e filtrar a lista sem perder escolhas já realizadas;
- iniciar os atletas pendentes com a predefinição masculina e trocar
  explicitamente as exceções para feminino antes do envio;
- enviar um lote parcial ou completo com progresso, justificativa comum e
  confirmação explícita;
- limpar escolhas ainda não enviadas ou abrir o formulário individual como
  alternativa;
- acompanhar contagens factuais de jogos, inscrições e competições afetadas;
- verificar quando todas as filas estiverem zeradas.

A tela é protegida por AAL2 e usa o relatório administrativo de reconciliação.
O backend não confia no navegador: valida origem, CSRF, sessão, formato,
duplicidades e existência dos atletas. O lote é atômico, limitado a 100 itens e
gera uma auditoria individual para cada revisão. Se qualquer item falhar, nenhum
é gravado. A predefinição existe somente no estado local da interface, não lê o
valor privado atual e não grava nada sem justificativa e confirmação. A
auditoria não guarda os valores privados escolhidos.

## Competições

### Lista e filtros

Em `/admin/competitions` é possível:

- buscar por nome da edição, série ou categoria;
- filtrar por ano;
- filtrar por situação: rascunho, aguardando validação, publicada ou arquivada;
- visualizar ano, situação, série, categoria e naipe;
- abrir o hub de uma edição;
- iniciar a criação de uma nova edição.

### Criação de edição

O assistente `/admin/competitions/new` possui três etapas:

1. **Identificação:** série, categoria, naipe, ano, nome e período opcional.
2. **Dados e formato:** fonte primária, justificativa de mudança, formato e
   quantidade de equipes.
3. **Revisão:** resumo integral antes da confirmação.

A edição é sempre criada como rascunho privado. Nenhum jogo ou conteúdo público
é criado automaticamente. Os formatos disponíveis são:

- grupo único em turno único;
- eliminatória simples em jogo único.

As vagas são reservadas na estrutura, mas as equipes precisam ser atribuídas
explicitamente. Naipe, fonte e participantes nunca são inferidos por nomes.

### Hub da edição

O caminho `/admin/competitions/{id}` centraliza a operação da edição e mostra:

- quantidade de equipes inscritas;
- quantidade de atletas disponíveis;
- quantidade de jogos;
- pendências de fonte de dados;
- inscrições, elencos e resultados finais;
- atalhos para estrutura, agenda, perfil de dados, publicação, exceções,
  súmula manual e importação de boxscore.

## Equipes inscritas e elencos

Dentro do hub da edição é possível:

- inscrever uma equipe global na edição;
- alterar uma inscrição de rascunho para confirmada e depois para concluída;
- remover somente uma inscrição provisória ainda sem histórico competitivo;
- retirar uma equipe preservando inscrições, jogos e histórico;
- consultar a decisão permitida antes de remover ou retirar;
- exigir justificativa e confirmação para a operação;
- montar ou substituir o elenco de uma inscrição;
- procurar atletas existentes antes de cadastrar outro;
- informar e preservar números de camisa;
- validar a elegibilidade privada antes de aceitar o atleta no elenco;
- confirmar colocação, retirada ou desclassificação ao final da edição;
- registrar colocação numérica e rótulo editorial.

Remover uma inscrição nunca apaga a equipe global. Quando já existe histórico,
o fluxo permitido é a retirada com preservação dos registros.

## Regulamento e estrutura

Em `/admin/competitions/{id}/structure` é possível:

- consultar o histórico de revisões estruturais;
- clonar uma estrutura compatível de outra edição;
- incluir, mediante escolha explícita, estruturas de outro naipe;
- criar um rascunho privado e independente;
- renomear etapas e rodadas;
- adicionar ou remover confrontos dentro da capacidade da rodada;
- configurar a origem de cada lado do confronto como vaga da edição ou vencedor
  de confronto anterior;
- manter origens ainda indefinidas como pendências explícitas.

O clone copia somente trilhas, etapas, rodadas, vagas e confrontos. Equipes,
jogos, resultados e publicações não são copiados. Revisões ativas ou publicadas
são somente leitura; a edição estrutural ocorre apenas em rascunho, com controle
de concorrência e auditoria.

## Estrutura e agenda

Em `/admin/competitions/{id}/schedule` é possível:

- atribuir inscrições confirmadas às vagas da estrutura;
- acompanhar confrontos e suas origens;
- preparar um confronto quando seus participantes estiverem resolvidos;
- gerar o jogo correspondente sem criar jogo paralelo;
- resolver a progressão usando o resultado oficial ativo;
- propagar vencedores para confrontos dependentes.

O banco valida capacidade, dependências e idempotência. A aplicação não inventa
participantes nem placares para avançar a chave.

## Naipe e perfil de dados

Em `/admin/competitions/{id}/data-profile` é possível:

- classificar explicitamente o naipe da edição;
- visualizar o impacto sobre jogos já existentes;
- vincular um perfil ativo compatível;
- criar e ativar uma nova versão do perfil;
- escolher a fonte primária entre súmula manual e boxscore FIBA/Genius Sports;
- justificar mudanças de fonte;
- preservar a versão anteriormente usada pelo histórico.

O sistema apresenta evidências factuais, como quantidade de jogos por origem,
mas nunca sugere o naipe ou decide a fonte pelo nome da competição, categoria,
equipes ou estatísticas.

## Súmula manual

Em `/admin/competitions/{id}/scoresheets/new` é possível:

- selecionar um jogo já existente na estrutura;
- conferir cabeçalho, horário, local e participantes;
- associar inscrições e atletas aos lados mandante e visitante;
- registrar camisas, participação, DNP e desqualificações quando aplicável;
- preencher a grade de estatísticas por período;
- registrar pontos, cestas convertidas e faltas;
- revisar totais derivados antes da confirmação;
- salvar a súmula de forma transacional e idempotente;
- informar uma justificativa quando a súmula assumir temporariamente o papel de
  fallback.

A confirmação atualiza o jogo existente. O fluxo não cria uma partida paralela
fora da estrutura da edição.

## Importação de boxscore FIBA/Genius Sports

Em `/admin/competitions/{id}/boxscores/import` é possível:

- enviar PDF de até 10 MiB;
- aceitar exclusivamente o modelo FIBA/Genius Sports documentado;
- extrair PDFs que possuam camada de texto;
- revisar jogo, equipes, placar e estatísticas antes de gravar;
- associar o documento a um jogo já existente;
- vincular cada equipe extraída à inscrição correspondente;
- associar atletas a cadastros existentes;
- visualizar alternativas de nomes semelhantes sem pré-seleção automática;
- criar atleta novo somente após escolha explícita e preenchimento da
  elegibilidade privada;
- confirmar a importação de forma transacional;
- impedir duplicidade pelo hash do arquivo;
- consultar importações recentes e retomar itens em revisão;
- recuperar estatísticas coletivas de importações antigas compatíveis.

O PDF permanece em armazenamento privado. O importador registra estatísticas de
atletas e, quando fornecidas pelo documento, indicadores coletivos como pontos
no garrafão, segunda chance, contra-ataque, pontos após turnovers, maior
vantagem, maior sequência e tempo em vantagem.

OCR, parser genérico e outros modelos de súmula PDF não fazem parte desta
versão.

## Fontes de dados e conflitos

Quando um jogo possui fallback manual ou recebe um boxscore posterior, o painel
oferece `/admin/games/{id}/data-conflict` para:

- comparar as submissões por domínio de dados;
- visualizar quais domínios possuem divergência;
- manter súmula e boxscore como fontes complementares quando possível;
- selecionar administrativamente a autoridade de cada domínio;
- registrar justificativa;
- finalizar um fallback manual quando o boxscore não chegar;
- preservar snapshots e a trilha de auditoria da decisão.

Nenhuma fonte substitui silenciosamente outra.

## Publicação

Em `/admin/competitions/{id}/publication` é possível:

- consultar o resumo calculado no servidor;
- visualizar a versão pública atual;
- conferir equipes confirmadas, jogos elegíveis e vagas pendentes;
- visualizar os bloqueios que impedem a publicação;
- confirmar manualmente uma nova versão pública.

Cada publicação é versionada. Mudanças posteriores permanecem privadas até nova
confirmação, e o painel não publica automaticamente uma edição apenas porque os
dados foram preenchidos.

## Exceções esportivas

Em `/admin/competitions/{id}/sports-exceptions` é possível:

- visualizar e confirmar o encerramento de um grupo;
- registrar a ordem final e os critérios de desempate;
- criar um snapshot final imutável da classificatória;
- registrar W.O., desistência ou decisão administrativa sem placar fictício;
- revisar o impacto antes de confirmar uma decisão;
- corrigir o vencedor de um confronto antes do ponto de corte;
- gerar nova revisão estrutural quando uma correção altera a progressão;
- preservar jogos, resultados anteriores e auditoria.

As operações exigem prévia de impacto, justificativa e confirmação explícita.

## Equipes globais

Em `/admin/teams` é possível:

- buscar equipes pelo nome;
- consultar nome e sigla;
- criar equipe com nome, slug e sigla opcional;
- impedir duplicidades.

Equipes novas nascem privadas. O painel atual não oferece exclusão de equipe.

## Atletas e dados privados

Em `/admin/players` é possível:

- buscar atletas pelo nome;
- consultar os cadastros existentes antes de criar outro;
- criar atleta com nome completo, apelido opcional e elegibilidade privada;
- bloquear duplicidade normalizada;
- exigir uma segunda confirmação quando houver nomes semelhantes;
- abrir o formulário privado de cada atleta.

Em `/admin/players/{id}/private-profile` é possível:

- consultar o nome público e a situação da revisão;
- visualizar o impacto em inscrições e competições;
- selecionar explicitamente o valor privado usado para elegibilidade;
- informar justificativa de 10 a 500 caracteres;
- salvar a revisão com auditoria.

O valor privado não aparece em buscas públicas, URLs, páginas de atleta ou
rascunhos. A auditoria registra a operação e o impacto, não publica os valores
anterior e novo.

## Comportamentos que o painel não oferece

- cadastro público ou recuperação administrativa de usuários;
- convites, múltiplos administradores, papéis ou permissões configuráveis;
- exclusão destrutiva de competições, equipes, atletas, jogos ou histórico;
- alteração direta de dados públicos sem passar pelos fluxos de revisão e
  publicação;
- inferência automática de naipe, elegibilidade, participantes ou autoridade;
- OCR, parser de PDF genérico ou importação de súmula oficial completa;
- configuração de domínio próprio;
- remoção das colunas legadas preservadas durante o rollout.

## Sequência operacional recomendada

1. Criar ou localizar equipes e atletas.
2. Criar a edição privada com naipe, fonte e formato explícitos.
3. Inscrever equipes e montar os elencos.
4. Revisar ou clonar a estrutura.
5. Atribuir as equipes às vagas e preparar os confrontos.
6. Registrar súmula manual ou importar o boxscore no jogo existente.
7. Resolver conflitos de fonte, se houver.
8. Confirmar resultados, progressão e exceções necessárias.
9. Revisar o resumo editorial e publicar uma versão.
10. Conferir as páginas públicas em sessão anônima.

## Estado do fechamento final

O enforcement final de perfil, naipe e elegibilidade está preparado no
`POST-04`, mas ainda não foi aplicado ao banco compartilhado. Antes da aplicação
é obrigatório concluir as classificações administrativas pendentes e obter o
relatório com todas as filas zeradas. Nenhum dado será preenchido por inferência
para acelerar esse fechamento.
