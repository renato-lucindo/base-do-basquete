---
id: TSK-061
tipo: desempenho
dependencias: [TSK-058, TSK-059, TSK-060]
risco: alto
---

# Implementar cache read-through

## Objetivo

Retornar dados cacheados ou calcular, salvar e retornar o mesmo DTO.

## Escopo permitido

Serviço de estatísticas e testes com cache falso.

## Passos

1. Consultar a chave.
2. Validar versão/formato do valor.
3. Em miss, executar a agregação uma vez.
4. Salvar com TTL definido.
5. Tratar cache indisponível sem esconder erro do banco.

## Critérios de aceite

- Hit não consulta o banco.
- Miss e resposta direta são byte/semanticamente equivalentes.
- Valor corrompido é descartado com segurança.

## Não alterar

Invalidação após escritas.
