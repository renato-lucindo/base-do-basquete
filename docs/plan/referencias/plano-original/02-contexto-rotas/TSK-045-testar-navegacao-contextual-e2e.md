---
id: TSK-045
tipo: teste
dependencias: [TSK-033, TSK-035, TSK-037, TSK-039, TSK-040, TSK-041, TSK-042, TSK-043, TSK-044]
risco: baixo
---

# Testar navegação contextual ponta a ponta

## Objetivo

Provar que a URL permanece fonte da verdade em toda a navegação pública.

## Escopo permitido

Testes de rota/navegação e fixtures.

## Cenários

1. Entrada pela raiz.
2. URL contextual direta.
3. Troca de contexto no seletor.
4. Header, breadcrumb, jogador, equipe e jogo.
5. Voltar/avançar e recarregar.
6. Contexto inválido e jogo de outra edição.
7. Acesso a `/admin`.

## Critérios de aceite

- IDs consultados correspondem ao contexto de cada cenário.
- Nenhum teste depende de ordem casual do banco.
- Todas as regressões falham antes da correção que protegem.

## Não alterar

Código de produto nesta tarefa.
