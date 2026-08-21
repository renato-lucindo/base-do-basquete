---
id: TSK-066
tipo: frontend
dependencias: [TSK-056, TSK-065]
risco: baixo
---

# Implementar toggle Média por Jogo / Totais

## Objetivo

Alternar apresentação sem refazer consulta ou misturar escalas.

## Escopo permitido

Controle de modo e transformação de visualização.

## Passos

1. Definir estado local ou parâmetro de busca conforme UX.
2. Mapear colunas afetadas.
3. Manter percentuais com semântica correta.
4. Atualizar rótulos/acessibilidade.
5. Testar alternância repetida.

## Critérios de aceite

- Totais e médias vêm do mesmo DTO validado.
- Não há nova requisição desnecessária.
- Modo atual é perceptível e acessível.

## Não alterar

Agregações ou cache.
