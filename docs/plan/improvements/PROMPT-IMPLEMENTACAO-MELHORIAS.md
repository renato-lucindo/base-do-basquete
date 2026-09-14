# Prompt para implementação

Use o plugin GitHub e trabalhe no repositório `renato-lucindo/base-do-basquete`.

Leia integralmente, antes de alterar qualquer código, os dois arquivos anexados:

1. `SELECAO-DE-MELHORIAS-SITE-BASK.md`
2. `TABELAS-PERFIL-JOGADORES.md`

Esses arquivos são requisitos normativos. Considere aprovados todos os itens marcados como **Fazer agora**, incluindo seus subitens, e respeite as decisões posteriores registradas nas observações. Não implemente `PUB-05 — Página completa da equipe`, que permanece adiado. O `site-bask` é somente uma referência de comportamento e aparência; não o altere e não copie sua arquitetura insegura.

## Objetivo

Implementar no `base-do-basquete` as melhorias públicas, estatísticas, administrativas e de perfil aprovadas nos documentos, preservando a arquitetura atual, a segurança e a integridade histórica do projeto.

## Regras obrigatórias

- Inspecione a `main` mais recente antes de começar.
- Preserve o monólito modular, React Router, Cloudflare Workers e Supabase.
- Mantenha backend, banco e read models como fontes autoritativas.
- Não introduza acesso ou escrita direta do navegador nas tabelas do Supabase.
- Preserve MFA/AAL2, RLS, CSRF, idempotência, auditoria e armazenamento privado.
- Não use listas fixas de anos, competições ou categorias.
- Não mova o parser seguro de PDF para o navegador.
- Não renomeie tabelas ou views já existentes em produção. Atualize-as por migrations compatíveis quando necessário.
- Evite dependências novas sem necessidade comprovada.
- A nova UI deve ser inspirada na densidade estatística e em alguns padrões do `site-bask`, sem copiá-lo integralmente.
- Priorize celular, desempenho e acessibilidade estrutural.
- Todo comportamento novo deve possuir testes automatizados proporcionais ao risco.
- Não pare depois de produzir um plano: implemente, valide e entregue o resultado.

## Modelo do perfil do atleta

Implemente a estrutura definida no arquivo de tabelas, observando:

- Adicionar `nickname` a `players`; deve ser público, pesquisável e não único.
- Criar `player_profiles` como relação 1:1 com `players`.
- Campos de `player_profiles`: `bio`, `height_cm`, `weight_kg`, `main_position`, `hand`, `home_city` e `home_state`.
- Os campos opcionais do perfil serão públicos por padrão.
- Criar `player_private` para dados que nunca devem ser expostos diretamente: data completa de nascimento e `federation_no`.
- Haverá somente um `federation_no` por atleta; ele é opcional e privado.
- O ano de nascimento será público por padrão, mas a data completa nunca será pública.
- Migrar com segurança o `birth_date` atual para a estrutura privada, sem perda de dados.
- Criar uma fachada pública segura, sem campos privados. Use o nome novo definido no modelo sem renomear estruturas existentes.
- Adicionar `position` a `roster_entries` para a posição específica do atleta naquela edição.
- Não adicionar o campo genérico de função/categoria ao elenco.
- Criar `player_honors` para honrarias individuais manuais, separadas de conquistas coletivas derivadas. Somente registros confirmados podem aparecer publicamente.
- Não criar `player_teams`; o histórico continuará derivado de `roster_entries` e `team_registrations`.
- Atualizar `competition_player_statistics` sem renomeá-la, incluindo faltas, equipe, sigla, camisa da edição e titularidades.
- Ao agregar faltas, estatísticas e titularidades, use agregações separadas antes dos joins para impedir multiplicação de totais.
- Atualizar tipos gerados, queries, loaders, validações, RLS, grants, testes de banco e testes TypeScript.

## Página pública do atleta

Todos os conteúdos permanecerão na mesma página. Crie uma navegação por âncoras com aparência de abas, exatamente nesta ordem:

1. `Resumo` → `#resumo`
2. `Estatísticas` → `#estatisticas`
3. `Conquistas e honrarias` → `#conquistas-honrarias`
4. `Jogos` → `#jogos`
5. `Histórico` → `#historico`

A navegação deve:

- permanecer acessível durante a rolagem;
- destacar a seção atualmente visível;
- respeitar acesso direto pelo hash;
- funcionar com voltar/avançar do navegador;
- funcionar por teclado;
- permitir rolagem horizontal em telas pequenas;
- usar `scroll-margin-top` ou solução equivalente para não ocultar títulos sob elementos fixos;
- ser implementada como navegação por links/âncoras, não como `tablist`, pois as seções não serão ocultadas.

## Estatísticas avançadas da partida

Foi escolhida a opção completa e recolhível:

- mostrar primeiro o grupo essencial: pontos de erros, garrafão, segunda chance, contra-ataque e banco;
- disponibilizar em uma seção “Mais estatísticas”: maior vantagem, maior sequência, trocas de liderança, empates, tempo na liderança, pontos por posse e demais métricas aprovadas;
- adaptar a apresentação para celular;
- reconciliar os valores apresentados com os dados autoritativos existentes.

## Rascunhos administrativos

Foi escolhida a opção completa:

- rascunho de edição de elenco;
- rascunho de súmula manual;
- rascunho da revisão de importação;
- aviso de restauração;
- ação para descartar;
- expiração automática;
- aviso antes de sair com alterações pendentes.

Nunca armazene localmente PDF, token, sessão, segredo ou credencial. Reaproveite o rascunho persistido no servidor quando ele já existir e evite criar duas fontes conflitantes.

## Busca

A busca contextual deve incluir:

- nome completo e apelido dos atletas;
- nome e sigla das equipes;
- competições, categorias e anos;
- normalização de acentos e busca por substring;
- resultados agrupados e limitados;
- preservação do contexto da edição;
- operação por teclado.

Implemente a busca no servidor com resposta mínima e controle de custo. Não carregue todos os registros no navegador.

## Decisão pendente do comparador

Implemente a expansão funcional do comparador aprovada no documento, mas não bloqueie as demais entregas pela decisão ainda pendente sobre texto invisível. Preserve o comportamento acessível atual quando houver dúvida e registre claramente no handoff o ponto que ainda precisa de decisão. Não use essa pendência para omitir as métricas, seleção pesquisável ou responsividade aprovadas.

## Fluxo de trabalho e entrega

1. Faça uma auditoria inicial e apresente um plano curto, organizado por pacotes verticais.
2. Crie uma branch de feature a partir da `main` atual.
3. Implemente em commits coerentes, preservando compatibilidade de migrations e dados existentes.
4. Execute todos os testes relevantes, incluindo migrations desde zero, testes de banco, lint, typecheck, build e o gate completo disponível no repositório.
5. Faça revisão de segurança e responsividade.
6. Abra um único pull request em modo draft, com resumo por pacote, migrations, testes executados, evidências, riscos e pendências.
7. Não faça merge nem deploy de produção sem autorização explícita.

Se algum requisito entrar em conflito real com o esquema ou com uma garantia de segurança existente, não escolha silenciosamente. Documente a evidência, proponha a alternativa mais segura e prossiga com o restante que não estiver bloqueado.

