---
id: TSK-088
tipo: parser
dependencias: [TSK-006, TSK-087]
risco: alto
---

# Auditar parser de boxscore

## Objetivo

Converter texto em payload tipado sem confirmar associações ou gravar dados.

## Escopo permitido

`src/lib/boxscore-parser.ts`, tipos e testes de parser.

## Passos

1. Definir versão do parser.
2. Extrair data, equipes, placar, jogadores e métricas.
3. Separar erros bloqueantes de avisos.
4. Preservar camisa `"00"`.
5. Testar linhas ausentes, ordem variável e campos inválidos.

## Critérios de aceite

- Parser é função pura.
- Payload guarda fonte suficiente para auditoria.
- Nenhuma associação aproximada ocorre no parser.

## Não alterar

Banco, RLS ou UI.
