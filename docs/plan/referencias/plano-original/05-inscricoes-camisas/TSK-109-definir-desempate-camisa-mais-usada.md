---
id: TSK-109
tipo: dominio
dependencias: [TSK-006, TSK-108]
risco: medio
---

# Definir desempate da camisa mais usada

## Objetivo

Escolher um único número de forma determinística quando as frequências empatarem.

## Escopo permitido

Função/ordenação de escolha e testes.

## Passos

1. Aplicar maior frequência.
2. Definir segundo critério, preferencialmente uso mais recente, conforme decisão do produto.
3. Definir terceiro critério estável.
4. Não converter texto em número para desempatar.
5. Testar empate entre `"00"` e `"0"`.

## Critérios de aceite

- Mesmos dados sempre produzem mesmo número.
- Critério está documentado na tarefa e teste.
- Ausência de usos retorna vazio explícito.

## Não alterar

Contagem ou componente do perfil.
