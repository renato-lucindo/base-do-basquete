---
id: TSK-082
tipo: seguranca
dependencias: [TSK-080]
risco: alto
---

# Validar arquivo PDF

## Objetivo

Aplicar tamanho e tipo no cliente para UX e no limite autoritativo para segurança.

## Escopo permitido

Validador de arquivo e testes.

## Passos

1. Confirmar limite de bytes.
2. Verificar extensão, MIME e assinatura quando bytes chegarem ao servidor.
3. Recusar arquivo vazio.
4. Não confiar em nome ou MIME isoladamente.
5. Testar PDF válido, vazio, grande e conteúdo incompatível.

## Critérios de aceite

- Arquivo inválido nunca chega à transação.
- Mensagem é clara e não revela internals.
- Limites são configurados em um único lugar.

## Não alterar

Extração de texto ou hash.
