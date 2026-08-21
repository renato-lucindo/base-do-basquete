---
id: TSK-032
tipo: roteamento
dependencias: [TSK-031]
risco: alto
---

# Auditar rota pública dinâmica

## Objetivo

Garantir o padrão público equivalente a `/:ano/:competicao/:categoria/:recurso` dentro da convenção adotada pelo projeto.

## Escopo permitido

Arquivo de rota contextual existente, como `src/routes/campeonatos.$year.$comp.$category.$resource.tsx`.

## Passos

1. Confirmar nomes reais dos parâmetros.
2. Enumerar recursos permitidos.
3. Recusar recurso desconhecido sem renderização parcial.
4. Carregar o contexto antes dos dados do recurso.
5. Garantir links compartilháveis e recarregamento direto.

## Critérios de aceite

- URL direta e navegação interna produzem o mesmo contexto.
- Recurso inválido não abre tela genérica.
- Parâmetros não são duplicados em estado local autoritativo.

## Não alterar

`/admin` e rotas de autenticação.
