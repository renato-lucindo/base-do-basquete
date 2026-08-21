---
id: TSK-192
tipo: release
dependencias: [TSK-186, TSK-187, TSK-191]
risco: alto
---

# Implantar preview de validação

## Objetivo

Publicar uma versão não produtiva no runtime Cloudflare real.

## Escopo permitido

Deploy de preview/staging autorizado, variáveis desse ambiente e relatório.

## Passos

1. Confirmar commit exato.
2. Usar bindings/segredos de staging.
3. Verificar health e logs iniciais.
4. Não apontar preview ao banco de produção.
5. Guardar URL/versão para smoke tests.

## Critérios de aceite

- Versão implantada corresponde ao SHA.
- Runtime inicia sem erro.
- Ambiente está isolado.

## Não alterar

Domínio/versão de produção.
