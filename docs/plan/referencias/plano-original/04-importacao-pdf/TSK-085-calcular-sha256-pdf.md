---
id: TSK-085
tipo: frontend-seguranca
dependencias: [TSK-021, TSK-082]
risco: medio
---

# Calcular SHA-256 do PDF

## Objetivo

Gerar hash determinístico dos bytes originais, preservando a garantia única no banco.

## Escopo permitido

Função de hash e testes com fixtures.

## Passos

1. Usar bytes do arquivo antes de qualquer transformação.
2. Produzir hexadecimal normalizado.
3. Validar formato esperado pelo banco.
4. Não usar MD5 se SHA-256 já for o padrão.
5. Testar mesmo conteúdo com nomes diferentes e conteúdos diferentes.

## Critérios de aceite

- Mesmo byte stream gera mesmo hash.
- Nome do arquivo não influencia o hash.
- Cliente não é a única barreira de duplicidade.

## Não alterar

Consulta de duplicidade.
