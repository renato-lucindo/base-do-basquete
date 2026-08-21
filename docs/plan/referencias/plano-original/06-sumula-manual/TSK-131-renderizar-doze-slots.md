---
id: TSK-131
tipo: frontend
dependencias: [TSK-130]
risco: baixo
---

# Renderizar 12 slots por equipe

## Objetivo

Apresentar prefill editável com identidade estável por slot.

## Escopo permitido

Componente de relacionados e testes.

## Passos

1. Criar 12 slots por lado.
2. Preencher com o resultado do prefill.
3. Usar chaves estáveis, não índice quando houver identidade própria.
4. Diferenciar slot vazio de carregamento.
5. Exibir equipe correspondente.

## Critérios de aceite

- Edição de um lado não afeta o outro.
- Menos de 12 atletas deixa slots vazios.
- Estado acompanha troca de equipe de forma controlada.

## Não alterar

Dropdown de substituição ou camisa.
