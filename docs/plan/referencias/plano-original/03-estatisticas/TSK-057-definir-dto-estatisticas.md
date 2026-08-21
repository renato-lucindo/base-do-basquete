---
id: TSK-057
tipo: contrato
dependencias: [TSK-050, TSK-054, TSK-055, TSK-056]
risco: medio
---

# Definir DTO de estatísticas

## Objetivo

Entregar dados tipados e explícitos para visões simples e avançadas.

## Escopo permitido

Tipos/schema de validação e testes.

## Passos

1. Separar identidade do jogador, totais, médias e disponibilidade.
2. Incluir `competitionId` no metadado da resposta.
3. Representar campos indisponíveis sem zeros falsos.
4. Definir ordem/paginação conforme volume real.
5. Validar resposta na fronteira.

## Critérios de aceite

- Categoria simples não precisa receber payload avançado.
- Campos opcionais têm semântica documentada.
- UI não acessa linhas brutas do banco.

## Não alterar

Consulta ou componente.
