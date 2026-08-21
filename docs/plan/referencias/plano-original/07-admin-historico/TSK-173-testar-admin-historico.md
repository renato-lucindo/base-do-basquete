---
id: TSK-173
tipo: teste
dependencias: [TSK-164, TSK-167, TSK-169, TSK-171, TSK-172]
risco: baixo
---

# Testar painel e histórico

## Objetivo

Cobrir seleção progressiva, preservação do admin e conquistas.

## Escopo permitido

Testes SQL, rota, componente e integração.

## Cenários

1. Seletor e atalhos recentes.
2. Hub e ações separadas.
3. Rotas administrativas preexistentes.
4. Colocação válida/inválida.
5. Conquista de equipe.
6. Conquista de jogador por elenco histórico.
7. Pendência de migração ambígua.

## Critérios de aceite

- Nenhum painel existente desaparece.
- Resultado não confirmado nunca aparece publicamente.
- Permissões são testadas.

## Não alterar

Código de produto nesta tarefa.
