---
id: TSK-065
tipo: frontend
dependencias: [TSK-050, TSK-057, TSK-058]
risco: medio
---

# Renderizar tabela avançada

## Objetivo

Exibir J, MIN, PTS, REB, RO, RD, AST, AC/AT, FG%, 3PC/3PT, 3P%, LLC/LLT, LL%, EF e +/-.

## Escopo permitido

Componente de tabela avançada e testes.

## Passos

1. Definir ordem e rótulos das colunas.
2. Formatar pares e percentuais.
3. Exibir indisponível sem inventar zero.
4. Oferecer rolagem/responsividade sem ocultar identidade.
5. Manter links contextuais.

## Critérios de aceite

- Todas e somente as colunas autorizadas aparecem.
- Valores batem com o DTO.
- Tabela é navegável por teclado/leitor de tela.

## Não alterar

Fórmulas ou backend.
