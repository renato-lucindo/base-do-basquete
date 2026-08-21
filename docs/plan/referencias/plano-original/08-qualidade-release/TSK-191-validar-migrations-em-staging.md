---
id: TSK-191
tipo: release-banco
dependencias: [TSK-024, TSK-185, TSK-187]
risco: alto
---

# Validar migrations em staging

## Objetivo

Aplicar a sequência completa em cópia/ambiente seguro antes da produção.

## Escopo permitido

Ambiente de staging autorizado e relatório; nenhuma produção.

## Passos

1. Registrar versão anterior.
2. Criar backup/ponto de recuperação conforme plataforma.
3. Aplicar migrations em ordem.
4. Executar testes SQL e reconciliação de contagens.
5. Executar plano de compatibilidade com app antigo/novo.

## Critérios de aceite

- Sem perda de registros.
- Backfills e constraints passam.
- App anterior não quebra durante janela compatível.

## Não alterar

Produção.
