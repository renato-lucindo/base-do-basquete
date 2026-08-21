---
id: TSK-104
tipo: frontend-admin
dependencias: [TSK-100, TSK-103]
risco: medio
---

# Criar seletor de equipe e edição

## Objetivo

Permitir ao admin iniciar/abrir uma inscrição com contexto explícito.

## Escopo permitido

Trecho administrativo de inscrições e testes.

## Passos

1. Exibir edição completa: ano, série e categoria.
2. Listar equipes não inscritas separadamente das inscritas.
3. Exigir confirmação antes de criar.
4. Atualizar consultas após sucesso.
5. Exibir erros padronizados.

## Critérios de aceite

- Não há competição padrão hardcoded.
- Seleção ambígua não permite gravação.
- Ações são bloqueadas sem permissão.

## Não alterar

Editor de elenco.
