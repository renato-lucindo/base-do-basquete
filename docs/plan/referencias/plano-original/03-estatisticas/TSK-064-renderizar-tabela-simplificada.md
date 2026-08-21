---
id: TSK-064
tipo: frontend
dependencias: [TSK-050, TSK-057, TSK-058]
risco: medio
---

# Renderizar tabela simplificada

## Objetivo

Exibir somente Jogos, média de PTS e total de PTS para categorias sem estatística avançada.

## Escopo permitido

Componente de tabela simples e testes de renderização.

## Passos

1. Consumir DTO simples.
2. Exibir estado vazio, loading e erro.
3. Formatar média sem recalcular regra.
4. Manter link contextual do atleta.
5. Validar responsividade e cabeçalhos.

## Critérios de aceite

- Nenhuma coluna avançada aparece.
- Componente não acessa campos avançados.
- Leitores de tela associam cabeçalhos e células.

## Não alterar

Tabela avançada ou consulta.
