---
id: TSK-030
tipo: frontend-dominio
dependencias: [TSK-004, TSK-005, TSK-024]
risco: medio
---

# Auditar `CompetitionContext`

## Objetivo

Garantir um tipo único para ID, ano, série, categoria, slugs e capacidades.

## Escopo permitido

`src/lib/competition-context.ts` ou módulo equivalente e testes unitários.

## Passos

1. Localizar tipo e conversores existentes.
2. Comparar campos com o contrato de `TSK-005`.
3. Remover apenas duplicidades comprovadas.
4. Validar conversão de linha Supabase para contexto.
5. Testar ausência de relação e valores inválidos.

## Critérios de aceite

- Toda rota pública usa o mesmo tipo.
- O tipo carrega `competitionId` sem nova consulta.
- Conversão inválida falha de modo explícito.

## Não alterar

Router, consultas de estatísticas ou UI.
