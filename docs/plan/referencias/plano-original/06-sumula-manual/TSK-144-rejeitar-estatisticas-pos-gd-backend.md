---
id: TSK-144
tipo: banco-dominio
dependencias: [TSK-127, TSK-142]
risco: alto
---

# Rejeitar estatísticas pós-GD no backend

## Objetivo

Impedir bypass da trava do cliente e persistir GD de forma consistente.

## Escopo permitido

Validação transacional/RPC e testes SQL.

## Passos

1. Recalcular GD no backend.
2. Identificar registros posteriores.
3. Recusar o payload inteiro com erro estruturado.
4. Derivar/persistir flag conforme `TSK-020`.
5. Testar chamada direta maliciosa.

## Critérios de aceite

- Nenhum dado pós-GD é gravado.
- Rollback é integral.
- Motivo da GD é auditável.

## Não alterar

Componente.
