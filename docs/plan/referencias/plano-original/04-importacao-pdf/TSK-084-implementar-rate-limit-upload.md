---
id: TSK-084
tipo: seguranca
dependencias: [TSK-080, TSK-081]
risco: alto
---

# Implementar rate limit do upload

## Objetivo

Limitar tentativas por usuário e, quando apropriado, por origem, em armazenamento compatível com múltiplas instâncias.

## Escopo permitido

Middleware/serviço do limite de upload e testes.

## Passos

1. Definir janela, limite e chave sem armazenar dado sensível bruto.
2. Aplicar antes de extração/processamento caro.
3. Retornar erro e tempo de nova tentativa padronizados.
4. Definir comportamento quando o limitador estiver indisponível.
5. Testar fronteira da janela e usuários distintos.

## Critérios de aceite

- Excesso é bloqueado antes do processamento.
- Uma pessoa não consome a cota de outra.
- Implementação funciona no runtime de produção.

## Não alterar

Limites globais de outras rotas.
