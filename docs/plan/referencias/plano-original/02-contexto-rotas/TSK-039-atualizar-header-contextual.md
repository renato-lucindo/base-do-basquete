---
id: TSK-039
tipo: frontend
dependencias: [TSK-037, TSK-038]
risco: medio
---

# Atualizar links do header

## Objetivo

Fazer Classificação, Jogadores, Equipes e Jogos permanecerem na edição ativa.

## Escopo permitido

Header/menu público e testes de links.

## Passos

1. Remover destinos absolutos sem contexto.
2. Gerar cada link pelo builder.
3. Indicar recurso ativo.
4. Tratar renderização antes de contexto resolvido.
5. Testar troca de competição seguida de clique.

## Critérios de aceite

- Todos os links contêm ano, competição e categoria corretos.
- Não há flash de link para competição padrão.
- Navegação por teclado é preservada.

## Não alterar

Autenticação, menu admin ou estilo global.
