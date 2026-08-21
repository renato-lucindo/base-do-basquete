---
id: TSK-087
tipo: parser
dependencias: [TSK-082]
risco: medio
---

# Extrair texto do PDF

## Objetivo

Isolar a extração do conteúdo da interpretação do boxscore.

## Escopo permitido

Adaptador de `pdfjs`/extrator e testes com PDF permitido.

## Passos

1. Extrair texto página a página em ordem.
2. Normalizar somente espaços/quebras necessários.
3. Preservar números e sinais.
4. Detectar PDF sem camada de texto.
5. Retornar erro que encaminhe para fluxo manual/OCR externo sem criar dados.

## Critérios de aceite

- Fixture produz texto determinístico.
- PDF vazio não chega ao parser.
- Extração não conhece regras de jogador ou placar.

## Não alterar

Parser de boxscore.
