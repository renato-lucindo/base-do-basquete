---
id: TSK-174
tipo: seguranca-teste
dependencias: [TSK-121, TSK-164, TSK-166, TSK-173]
risco: alto
---

# Validar regressão de permissões do admin

## Objetivo

Provar que novas rotas e RPCs não ampliaram acesso.

## Escopo permitido

Matriz/testes por papel.

## Passos

1. Enumerar leitura e escrita de cada tela/RPC.
2. Executar como anônimo, autenticado comum e admin.
3. Testar acesso direto por URL.
4. Testar chamada direta ao Supabase.
5. Registrar diferenças do baseline.

## Critérios de aceite

- Nenhum acesso novo fica implícito.
- Admin mantém funções necessárias.
- Usuários inferiores recebem bloqueio consistente.

## Não alterar

Políticas nesta tarefa; falhas geram tarefa corretiva separada.
