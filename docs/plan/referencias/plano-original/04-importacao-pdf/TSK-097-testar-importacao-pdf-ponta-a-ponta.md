---
id: TSK-097
tipo: teste
dependencias: [TSK-081, TSK-082, TSK-083, TSK-084, TSK-086, TSK-089, TSK-094, TSK-095, TSK-096]
risco: baixo
---

# Testar importação PDF ponta a ponta

## Objetivo

Provar segurança, integridade e navegação sem depender de PDF de produção.

## Escopo permitido

Testes unitários, SQL e integração.

## Cenários

1. Não autorizado e rate limit.
2. Arquivo inválido e sem texto.
3. Hash duplicado concorrente.
4. Match exato, sugestão e ambiguidade.
5. Erro intermediário com rollback.
6. Sucesso com jogo, boxscore, auditoria e navegação.
7. Invalidação seletiva de cache.

## Critérios de aceite

- Nenhum cenário deixa dados parciais.
- Teste prova que similaridade exige revisão.
- Resultado público pertence à competição escolhida.

## Não alterar

Código de produto nesta tarefa.
