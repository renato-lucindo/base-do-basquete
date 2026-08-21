---
id: TSK-023
tipo: seguranca
dependencias: [TSK-002, TSK-005, TSK-013, TSK-014, TSK-021]
risco: alto
---

# Revisar RLS dos dados de campeonato

## Objetivo

Garantir leitura pública somente do necessário e escrita administrativa protegida.

## Escopo permitido

Políticas RLS das tabelas da frente e testes por papel.

## Passos

1. Enumerar operações por `anon`, autenticado comum e admin.
2. Testar acesso direto às tabelas e RPCs.
3. Remover dependência exclusiva de esconder botões.
4. Restringir importações, inscrições, resultados e súmulas.
5. Garantir que funções `security definer` validem o papel internamente.

## Critérios de aceite

- Usuário público não grava dados administrativos.
- Admin autorizado mantém os fluxos.
- Testes negativos provam o bloqueio.

## Não alterar

Sistema de autenticação fora das políticas necessárias.
