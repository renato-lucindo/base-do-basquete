---
id: TSK-194
tipo: teste-release
dependencias: [TSK-097, TSK-112, TSK-149, TSK-173, TSK-192]
risco: alto
---

# Executar smoke administrativo no preview

## Objetivo

Validar painel, importação, inscrições, súmula e resultados com conta de staging.

## Escopo permitido

Preview e dados descartáveis de staging.

## Cenários

1. Login e módulos globais.
2. Hub da edição.
3. Inscrição e elenco.
4. PDF válido e duplicado.
5. Súmula com OT/GD.
6. Colocação e conquistas.

## Critérios de aceite

- Escritas são atômicas.
- Cache atualiza após confirmação.
- Módulos antigos continuam acessíveis.

## Não alterar

Produção.
