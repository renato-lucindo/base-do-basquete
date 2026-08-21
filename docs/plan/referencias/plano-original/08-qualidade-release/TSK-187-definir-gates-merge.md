---
id: TSK-187
tipo: processo
dependencias: [TSK-182, TSK-183, TSK-184, TSK-185, TSK-186]
risco: baixo
---

# Definir gates antes de merge

## Objetivo

Estabelecer quais verificações devem estar verdes para integrar tarefas.

## Escopo permitido

Documento/processo e, se autorizado separadamente, proteção de branch.

## Passos

1. Listar jobs obrigatórios.
2. Definir exceção e responsável.
3. Exigir teste-alvo além da suíte global.
4. Exigir migration reversível/compatível quando houver banco.
5. Não alterar proteção sem autorização explícita.

## Critérios de aceite

- Critérios são objetivos.
- Um fragmento não passa com teste-alvo ausente.
- Processo diferencia PR de hotfix.

## Não alterar

Configurações externas nesta tarefa.
