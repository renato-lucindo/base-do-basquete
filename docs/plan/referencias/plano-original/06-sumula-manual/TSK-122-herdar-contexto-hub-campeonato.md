---
id: TSK-122
tipo: frontend-admin
dependencias: [TSK-030, TSK-120]
risco: medio
---

# Herdar contexto do hub do campeonato

## Objetivo

Abrir o editor com `competition_id` explícito selecionado no painel.

## Escopo permitido

Navegação hub → editor e validação inicial.

## Passos

1. Receber ID por parâmetro/estado de rota definido.
2. Resolver e validar a competição.
3. Não usar competição hardcoded como padrão.
4. Exigir seleção quando o editor for aberto sem contexto.
5. Tratar edição inativa conforme contrato.

## Critérios de aceite

- Toda súmula nasce com edição inequívoca.
- Contexto inválido não carrega elencos.
- Voltar retorna ao hub correto.

## Não alterar

Campos do jogo.
