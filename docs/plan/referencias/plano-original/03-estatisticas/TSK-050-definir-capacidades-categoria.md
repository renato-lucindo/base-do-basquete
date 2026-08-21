---
id: TSK-050
tipo: dominio
dependencias: [TSK-004, TSK-005, TSK-030]
risco: alto
---

# Definir capacidades por categoria

## Objetivo

Substituir condicionais espalhadas por uma política tipada que indique estatísticas, filtros e comparação disponíveis.

## Escopo permitido

Módulo puro de capacidades e testes unitários.

## Passos

1. Definir identificador canônico da categoria.
2. Mapear Série Ouro para recursos avançados.
3. Mapear Base, Prata e Bronze para recursos simplificados.
4. Definir comportamento seguro para categoria desconhecida.
5. Testar cada classe.

## Critérios de aceite

- UI e consultas consomem a mesma política.
- Categoria desconhecida recebe conjunto mínimo, não avançado.
- Nenhuma regra depende de texto visual traduzido.

## Não alterar

Consultas, componentes ou banco.
