---
id: TSK-193
tipo: teste-release
dependencias: [TSK-045, TSK-072, TSK-096, TSK-192]
risco: baixo
---

# Executar smoke público no preview

## Objetivo

Validar navegação e leitura contextual no runtime implantado.

## Escopo permitido

Preview e fixtures de staging.

## Cenários

1. Raiz e contexto recente.
2. Header e breadcrumbs.
3. Classificação, jogadores, equipes, jogos e estatísticas.
4. Categoria simples e Ouro.
5. URL inválida.
6. Jogo de outro contexto.

## Critérios de aceite

- Nenhum erro de console/rede crítico.
- Dados correspondem à fixture.
- 404 e isolamento funcionam.

## Não alterar

Dados ou código durante o smoke.
