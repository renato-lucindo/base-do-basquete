# STATS-03 — Explorador público de estatísticas

## Entrega

A rota pública de jogadores usa o explorador boxscore quando existe snapshot compatível e mantém o explorador anterior como fallback de rollout. Não foi adicionado um segundo hero.

Os controles principais cobrem busca, equipe, três modos e três escopos. Filtros, colunas e comparação ficam em ações secundárias. Todo estado compartilhável permanece na URL; troca de modo ou escopo reinicia a página. Em `per-30`, `MIN` é ocultada e desabilitada sem apagar a preferência armazenada.

A tabela oferece cabeçalhos ordenáveis com `aria-sort`, região horizontal focalizável, camisa contextual, líderes com ícone e texto para leitor de tela, `-` para amostra insuficiente e `—` para fonte indisponível. O estado vazio não troca de escopo automaticamente.

## Verificação focal

- 7 arquivos e 33 testes focais aprovados após a integração;
- TypeScript estrito aprovado;
- formatação e lint dos módulos alterados aprovados, ressalvados os avisos históricos do CSS global;
- responsividade, acessibilidade automatizada e preview ainda pertencem ao gate STATS-04.
