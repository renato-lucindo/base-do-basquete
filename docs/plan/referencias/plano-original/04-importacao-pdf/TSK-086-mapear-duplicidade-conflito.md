---
id: TSK-086
tipo: integracao
dependencias: [TSK-021, TSK-083, TSK-085]
risco: medio
---

# Mapear duplicidade para conflito

## Objetivo

Converter violação de hash único em erro de domínio previsível, mesmo sob concorrência.

## Escopo permitido

Mapeador de erros no limite do upload e teste.

## Passos

1. Manter consulta preliminar apenas como melhoria de UX.
2. Capturar a violação autoritativa do banco.
3. Mapear para `IMPORT_ALREADY_EXISTS`/HTTP 409 quando houver HTTP.
4. Não expor SQL ou stack.
5. Testar corrida entre duas importações.

## Critérios de aceite

- Ambos os caminhos de duplicidade exibem a mesma mensagem.
- Apenas uma importação é confirmada.
- Erros não relacionados não viram conflito.

## Não alterar

Constraint do banco.
