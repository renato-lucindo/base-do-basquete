---
id: TSK-164
tipo: regressao
dependencias: [TSK-160, TSK-162, TSK-163]
risco: alto
---

# Preservar gestão global do painel

## Objetivo

Manter criação/gestão de campeonatos, equipes, atletas, jogos e permissões existentes.

## Escopo permitido

Composição/navegação do painel e testes de regressão.

## Passos

1. Inventariar módulos existentes antes da mudança.
2. Garantir links e permissões após adicionar dashboard/hub.
3. Não mover consultas globais para contexto sem requisito.
4. Testar acesso direto às rotas antigas.
5. Comparar telas críticas com baseline.

## Critérios de aceite

- Nenhum módulo desaparece.
- Rotas administrativas continuam carregando.
- Usuários mantêm o mesmo nível de acesso.

## Não alterar

Regras internas dos módulos.
