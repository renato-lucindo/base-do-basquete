---
id: TSK-129
tipo: dados
dependencias: [TSK-017, TSK-128]
risco: medio
---

# Consultar relacionados do último jogo

## Objetivo

Recuperar até 12 atletas e camisas da partida confirmada mais recente da equipe na mesma edição.

## Escopo permitido

Consulta específica e testes.

## Passos

1. Filtrar por competição e equipe.
2. Considerar somente jogo confirmado anterior.
3. Ordenar por data/hora e desempate estável.
4. Retornar jogadores ainda presentes no elenco.
5. Marcar ausências por mudanças de elenco.

## Critérios de aceite

- Jogo de outra categoria não serve de base.
- Resultado é determinístico.
- Nenhum atleta removido é reintroduzido silenciosamente.

## Não alterar

Slots da interface.
