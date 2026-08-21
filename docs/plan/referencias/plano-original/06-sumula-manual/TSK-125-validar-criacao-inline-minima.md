---
id: TSK-125
tipo: frontend-admin
dependencias: [TSK-123, TSK-124]
risco: medio
---

# Validar criação inline mínima

## Objetivo

Se o fluxo atual permitir criar time/categoria no editor, exigir dados mínimos e voltar ao contexto correto.

## Escopo permitido

Modal/formulário inline existente e testes; não criar a função se o produto não a aprovou.

## Passos

1. Auditar se criação inline já existe.
2. Definir campos obrigatórios pelo schema.
3. Validar slug/nome e duplicidade.
4. Atualizar somente a lista relacionada após sucesso.
5. Não salvar rascunho da súmula durante a criação.

## Critérios de aceite

- Entidade incompleta não é criada.
- Contexto do editor não muda acidentalmente.
- Ausência da função é documentada, não presumida como lacuna.

## Não alterar

Cadastro global fora do modal.
