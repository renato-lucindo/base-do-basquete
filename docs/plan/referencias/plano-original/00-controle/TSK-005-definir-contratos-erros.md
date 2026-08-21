---
id: TSK-005
tipo: decisao
dependencias: [TSK-003, TSK-004]
risco: medio
---

# Definir contratos de entrada, saída e erro

## Objetivo

Padronizar os limites entre rota, consultas Supabase, RPCs e interface.

## Escopo permitido

Documento de contrato com tipos e exemplos mínimos; sem implementação.

## Passos

1. Definir `CompetitionContext` e capacidades da categoria.
2. Definir respostas para contexto inexistente, conflito, não autorizado, limite e validação.
3. Definir códigos estáveis para erros de inscrição, importação e súmula.
4. Separar mensagem segura ao usuário de detalhe interno de auditoria.
5. Definir idempotência para escritas transacionais.

## Critérios de aceite

- Cada fluxo crítico tem entrada, saída e erros enumerados.
- Interface não depende de texto livre para decidir comportamento.
- Nenhum dado sensível aparece no contrato público.

## Não alterar

Implementação, schema ou dependências.
