---
id: TSK-018
tipo: banco
dependencias: [TSK-017, TSK-006]
risco: medio
---

# Garantir camisa como texto

## Objetivo

Preservar literalmente `"00"` em todas as fontes de dados de partida.

## Escopo permitido

Colunas de número em registros de boxscore/súmula/relacionados, validações e testes.

## Passos

1. Auditar tipos reais e tipos TypeScript.
2. Identificar conversões numéricas no parser e na UI.
3. Definir formato textual permitido.
4. Fazer migration compatível somente onde necessário.
5. Testar ida e volta de `"00"` e `"0"`.

## Critérios de aceite

- `"00"` não é convertido em `"0"` nem em número.
- Valores inválidos são rejeitados de forma consistente.
- Dados históricos permanecem legíveis.

## Não alterar

Consulta de camisa mais usada ou layout do perfil.
