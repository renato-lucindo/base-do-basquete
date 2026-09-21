# Requisitos funcionais consolidados

## Identidade do produto

- Nome público: **Base do Basquete**.
- Posicionamento: base de dados e histórico de campeonatos, equipes, atletas, jogos e estatísticas do basquete.
- Domínio próprio: a definir posteriormente; não faz parte do escopo atual.

## Site público

- Navegação contextual por ano, campeonato, categoria e recurso.
- URL como fonte do contexto.
- Redirecionamento da raiz para o contexto mais recente ou último contexto válido.
- Retorno 404 para combinações inválidas.
- Header, breadcrumb e links de jogadores, equipes e jogos preservando o contexto.
- Páginas públicas de equipe, jogador, jogo e estatísticas.

## Campeonatos e administração

- Gerenciar campeonatos, edições e categorias.
- Exibir dashboard com seletor e atalhos recentes.
- Criar hub administrativo por edição.
- Preservar uma área de gestão global.
- Separar claramente as ações de súmula manual e importação de boxscore.

## Equipes, inscrições e elencos

- Cadastrar e editar equipes e jogadores.
- Inscrever equipes por edição.
- Controlar estado da inscrição.
- Gerenciar elenco por equipe e edição.
- Impedir jogador em duas equipes na mesma edição.
- Salvar alterações de elenco de forma transacional.
- Preservar número de camisa como texto, incluindo `"00"` e `"0"`.
- Impedir camisa duplicada no mesmo contexto.
- Manter histórico e calcular a camisa mais utilizada com desempate determinístico.

## Jogos e súmula manual

- Criar jogo com edição, categoria, equipes, data e local válidos.
- Selecionar somente equipes e jogadores elegíveis para a edição.
- Sugerir relacionados do último jogo ou aplicar fallback alfabético.
- Exibir doze slots por equipe, permitindo slots não aplicáveis.
- Permitir substituição de jogador e sugestão da última camisa.
- Registrar estatísticas por Q1–Q4 e prorrogações.
- Registrar arremessos de 2, 3 e lance livre.
- Derivar pontos de jogador, equipe e placar.
- Registrar faltas e desqualificação por GD.
- Bloquear entradas posteriores à desqualificação.
- Impedir encerramento empatado e abrir OT quando necessário.
- Salvar toda a súmula em uma única transação.

## Estatísticas

- Isolar todos os resultados por edição/categoria.
- Calcular jogos, pontos, rebotes ofensivos/defensivos/totais, assistências e arremessos.
- Calcular percentuais, médias, minutos, eficiência e mais/menos quando a categoria permitir.
- Oferecer tabela simplificada para categorias sem estatísticas avançadas.
- Alternar média por jogo e totais.
- Aplicar filtros matemáticos avançados.
- Comparar jogadores com indicação acessível, sem depender apenas de cor.
- Não executar consultas avançadas para categoria simples.

## Importação de boxscore em PDF

- A importação atual é de boxscore, não de súmula oficial completa.
- Aceitar somente os contratos explícitos e versionados FIBA/Genius Sports e Basketball Site definidos em `MODELO-BOXSCORE-FIBA.md` e `MODELO-BOXSCORE-SITE.md`.
- Usar os dois PDFs FIBA como fixtures obrigatórias do mesmo parser e o PDF Basketball Site como fixture obrigatória de seu parser próprio.
- Não interpretar formatos sem contrato, criar parser genérico nem habilitar OCR nesta etapa.
- Permitir upload somente a administrador autorizado.
- Validar tamanho, assinatura real, formato, páginas e rate limit no backend.
- Calcular SHA-256 e bloquear duplicidade.
- Extrair texto de PDF que já possua camada textual.
- Interpretar equipes, jogadores, períodos, placar e estatísticas disponíveis.
- Validar consistência do boxscore.
- Normalizar nomes e associar primeiro por correspondência exata única.
- Sugerir candidatos semelhantes filtrados pelo elenco da edição.
- Exigir revisão humana para associações ambíguas antes do commit.
- Persistir rascunho, versão do parser, decisões, autor e auditoria.
- Confirmar o jogo e estatísticas em transação idempotente.
- Nunca deixar jogo parcialmente importado.
- Se não houver camada de texto, encaminhar para preenchimento manual e informar que OCR poderá ser adicionado futuramente.

## Histórico e conquistas

- Registrar colocação final e resultado confirmado por equipe.
- Consultar e exibir conquistas de equipes.
- Consultar e exibir conquistas de jogadores por participação em elenco.
- Manter histórico por campeonato, edição e categoria.

## Operação

- Auditoria de escritas administrativas.
- IDs de correlação e logs sem dados sensíveis.
- Preview, staging, smoke público, smoke administrativo e produção.
- Rollback sem exclusão de dados.
- Reconciliação de dados após migrations e implantação.
