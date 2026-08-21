---
id: TSK-190
tipo: observabilidade
dependencias: [TSK-083, TSK-102, TSK-127]
risco: medio
---

# Instrumentar importação, elenco e súmula

## Objetivo

Registrar início, sucesso, falha e duração usando IDs de correlação.

## Escopo permitido

Logs/métricas nos limites transacionais e testes.

## Passos

1. Gerar/propagar correlation ID.
2. Registrar operação, competição, resultado e duração.
3. Redigir tokens, conteúdo de PDF e dados pessoais.
4. Diferenciar erro de validação e erro interno.
5. Não afirmar sucesso antes do commit.

## Critérios de aceite

- Uma operação pode ser rastreada ponta a ponta.
- Logs não expõem payload completo.
- Falha identifica etapa sem revelar segredo.

## Não alterar

Semântica das transações.
