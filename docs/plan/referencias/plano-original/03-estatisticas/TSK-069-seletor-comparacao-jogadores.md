---
id: TSK-069
tipo: frontend
dependencias: [TSK-050, TSK-057, TSK-065]
risco: medio
---

# Criar seletor de comparação

## Objetivo

Permitir escolher jogadores apenas da competição ativa.

## Escopo permitido

Componente de seleção e teste.

## Passos

1. Usar lista já isolada por competição.
2. Impedir seleção duplicada.
3. Definir quantidade suportada.
4. Limpar seleção ao trocar contexto.
5. Tratar jogador removido da resposta.

## Critérios de aceite

- Atleta de outra competição não aparece.
- Categoria simples não monta o componente.
- Seleção é utilizável por teclado.

## Não alterar

Cálculo ou cores da comparação.
