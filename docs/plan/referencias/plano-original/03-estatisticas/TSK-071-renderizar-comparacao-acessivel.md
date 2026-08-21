---
id: TSK-071
tipo: frontend
dependencias: [TSK-070]
risco: baixo
---

# Renderizar comparação com sinal além da cor

## Objetivo

Usar verde/vermelho sem tornar a cor o único meio de interpretação.

## Escopo permitido

Componente de comparação e teste de acessibilidade.

## Passos

1. Mapear estados da função pura.
2. Adicionar texto/ícone/semântica para melhor, pior e empate.
3. Validar contraste.
4. Exibir indisponível explicitamente.
5. Testar com classes e rótulos.

## Critérios de aceite

- Informação é compreensível sem cor.
- Empates não recebem destaque enganoso.
- Leitor de tela anuncia o estado.

## Não alterar

Cálculo das diferenças.
