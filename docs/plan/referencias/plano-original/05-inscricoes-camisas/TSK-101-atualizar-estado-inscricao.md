---
id: TSK-101
tipo: banco
dependencias: [TSK-013, TSK-100]
risco: alto
---

# Atualizar estado da inscrição

## Objetivo

Controlar transições entre pendente, confirmada, retirada ou desqualificada.

## Escopo permitido

RPC/serviço e testes de transição.

## Passos

1. Definir transições permitidas.
2. Validar autorização.
3. Impedir estado incompatível com resultado.
4. Registrar timestamp/auditoria quando existente.
5. Testar transições válidas e inválidas.

## Critérios de aceite

- Estado não muda por update genérico inseguro.
- Transição inválida é recusada.
- Histórico relacionado não é apagado.

## Não alterar

`final_placement` ou elenco.
