---
id: TSK-189
tipo: observabilidade
dependencias: [TSK-059, TSK-061, TSK-188]
risco: medio
---

# Instrumentar hit, miss e invalidação

## Objetivo

Observar eficiência e falhas do cache sem registrar payload ou dados pessoais.

## Escopo permitido

Métricas/logs do serviço de cache e testes.

## Passos

1. Contar hit, miss, erro e invalidação.
2. Registrar competição de forma não sensível/ID técnico conforme política.
3. Medir latência de cálculo.
4. Evitar log do JSON de estatísticas.
5. Definir alerta para falhas persistentes.

## Critérios de aceite

- É possível detectar cache inoperante.
- Logs não contêm nomes de atletas.
- Instrumentação não muda resposta.

## Não alterar

Política de cache.
