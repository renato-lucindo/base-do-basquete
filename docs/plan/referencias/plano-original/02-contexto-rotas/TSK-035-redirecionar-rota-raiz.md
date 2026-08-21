---
id: TSK-035
tipo: roteamento
dependencias: [TSK-034, TSK-036]
risco: medio
---

# Redirecionar a rota raiz

## Objetivo

Enviar `/` para o último contexto válido ou, na ausência dele, para o mais recente.

## Escopo permitido

Rota raiz e teste de navegação.

## Passos

1. Ler a preferência validada produzida por `TSK-036`.
2. Confirmar que o contexto ainda existe.
3. Usar o contexto mais recente como fallback.
4. Evitar loop de redirecionamento.
5. Definir comportamento quando não existe competição.

## Critérios de aceite

- Preferência inválida nunca abre dados errados.
- URL final é contextual e compartilhável.
- Teste cobre primeira visita e retorno.

## Não alterar

Seleção manual ou páginas administrativas.
