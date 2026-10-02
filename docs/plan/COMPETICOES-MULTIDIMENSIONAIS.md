# Competições multidimensionais e interface compacta

## Resumo

- Organizar cada temporada por `campeonato + ano + naipe`.
- Tratar a unidade esportiva final como uma **disputa**, formada por categoria etária e, opcionalmente, divisão competitiva.
- Criar somente as combinações necessárias, sem gerar categorias ou divisões antecipadamente.
- Substituir cards em todo o projeto por listas, tabelas, linhas e seções compactas.
- Ocultar temporariamente o widget Sienna, sem botão ou menu de acessibilidade visível. Seu código e dependência permanecerão disponíveis para futura reativação.

## Modelo e contratos

- Criar um registro-pai de temporada contendo campeonato, ano, naipe, nome e descrição compartilhados.
- Manter `competitions` como a disputa administrável, vinculada a:
  - uma temporada;
  - uma categoria etária;
  - opcionalmente, um valor de divisão competitiva.
- Usar “Adulto” como categoria para campeonatos sem divisão por idade.
- Adicionar configuração de divisão por temporada:
  - tipo configurável: Série, Divisão, Conferência etc.;
  - valores ordenados: Ouro, Prata, Bronze ou 1ª, 2ª, 3ª;
  - no máximo um tipo competitivo por temporada;
  - cada disputa pode usar um valor ou ficar sem divisão.
- Permitir exemplos como `Adulto`, `Adulto · Série Ouro`, `Sub-15` e `Sub-15 · Série Ouro`.
- Impedir duplicidade da mesma combinação de temporada, categoria e divisão.
- Não automatizar promoção ou rebaixamento.
- Migrar competições existentes sem alterar IDs históricos de jogos, estatísticas ou publicações.
- Atualizar RLS, RPCs, auditoria, tipos e read models correspondentes.

## Criação e navegação

- Na criação inicial, solicitar nome, ano, naipe, descrição, primeira categoria e, opcionalmente, tipo e valor de divisão.
- Permitir adicionar posteriormente uma categoria, valor de divisão ou combinação entre ambos.
- Herdar nome, descrição, ano, naipe e datas sugeridas; formato, equipes, agenda e resultados permanecem independentes.
- Lista administrativa:
  - uma linha principal por campeonato, ano e naipe;
  - primeiro nível do accordion por categoria;
  - segundo nível por divisão somente quando existir;
  - ocultar o nível redundante “Adulto” quando o campeonato tiver apenas divisões competitivas;
  - incluir ações compactas para abrir ou adicionar disputas.

## Área da disputa

- Cabeçalho compacto com campeonato, categoria, divisão, ano, naipe e situação.
- Navegação superior:
  - Informações;
  - Equipes inscritas;
  - Agenda;
  - Resultados;
  - ação destacada “Importar jogo”.
- Em telas estreitas, usar abas horizontais roláveis.
- Informações:
  - editar nome e descrição compartilhados;
  - editar datas, categoria, divisão e formato;
  - alterações compatíveis de formato exigem confirmação simples;
  - alterações incompatíveis com agenda ou resultados são bloqueadas pelo backend.
- Equipes:
  - permitir várias inscrições da mesma equipe;
  - exigir nome público único por inscrição, como “Lobos” e “Lobos B”;
  - manter elencos, vagas e participações separados.
- Agenda:
  - criar e editar confrontos futuros com data, horário, local e inscrições.
- Resultados:
  - mostrar todos os jogos finalizados, vindos de PDF ou súmula manual.
- Importação:
  - permitir vincular um jogo agendado ou criar o jogo durante a importação;
  - detectar possíveis duplicidades antes da confirmação.

## Site público, URLs e visual

- Exibir categoria e divisão como filtros separados.
- Preservar URLs existentes para disputas sem divisão.
- Para divisões, usar rota canônica explícita como `/{ano}/{campeonato}/{categoria}/divisao/{divisao}/{secao}`.
- Isolar classificação, estatísticas e cache por disputa.
- Remover cards das páginas públicas e administrativas.
- Usar divisores, listas, tabelas, alinhamento e tipografia para estabelecer hierarquia.
- Manter placares e métricas agrupados, mas sem caixas elevadas individuais.
- Usar títulos responsivos compactos, aproximadamente 24–32 px.
- Reduzir margens, heros e espaços verticais excessivos.

## Widget de acessibilidade

- Impedir temporariamente a renderização de `SiennaAccessibility` no shell global.
- Não carregar o script do widget no navegador enquanto estiver desativado.
- Manter componente, loader, pacote e preparação do bundle no repositório para reativação futura simples.
- Não exibir botão, menu, faixa ou configuração de acessibilidade.
- Não desenvolver novas funções visíveis de acessibilidade nesta unidade.
- Preservar sem alterações a base estrutural invisível já existente, incluindo HTML semântico, teclado, foco, redução de movimento e testes atuais.

## Testes e aceite

- Banco: backfill, unicidade das combinações, RLS, divisão opcional e múltiplas inscrições da mesma equipe.
- Domínio: Adulto simples, categorias, divisões e combinação `Sub-15 · Ouro`.
- Isolamento: agenda, classificação, estatísticas, publicação e cache separados por disputa.
- Interface: accordion adaptativo, abas, filtros, criação tardia e estados vazio, erro e carregamento.
- Importação: jogo agendado, criação durante importação e detecção de duplicidade.
- Regressão: IDs e vínculos históricos preservados; URLs antigas continuam válidas.
- Widget: confirmar ausência do botão, do menu e do script Sienna no navegador.
- Confirmar que ocultar o widget não remove nem altera comportamentos estruturais existentes.
- Validar 390 px, desktop e reflow de 200%.
- Executar lint, formatação, typecheck, Vitest, pgTAP, build, scan de segredos, preview, smoke AAL2 e revisões obrigatórias.

## Premissas

- Categoria etária e divisão competitiva permanecem conceitos separados.
- Só combinações efetivamente utilizadas serão criadas.
- Cada temporada possui no máximo um tipo de divisão competitiva.
- Promoção e rebaixamento permanecem manuais.
- A desativação temporária se aplica exclusivamente ao widget Sienna visível, não às garantias estruturais internas do projeto.

## Ordem de entrega aprovada

1. Modelo de temporada, categoria etária e divisão competitiva, incluindo migration, backfill, RLS, RPCs, tipos e testes.
2. Múltiplas inscrições da mesma equipe com nomes públicos distintos.
3. Criação, lista compacta e accordion administrativo.
4. Navegação da disputa: Informações, Equipes, Agenda, Resultados e Importar jogo.
5. Contexto público, URLs e isolamento por disputa.
6. Revisão visual compacta global, removendo cards.
7. Ocultação temporária do Sienna, preservando código, dependência e acessibilidade estrutural.

Cada item deve ser entregue em PR vertical própria, na ordem acima. Migration compartilhada, merge e produção exigem autorização explícita.
