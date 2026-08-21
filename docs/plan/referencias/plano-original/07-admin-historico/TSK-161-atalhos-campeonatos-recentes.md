---
id: TSK-161
tipo: frontend-admin
dependencias: [TSK-160]
risco: baixo
---

# Adicionar atalhos recentes

## Objetivo

Mostrar campeonatos acessados recentemente sem transformá-los em fonte da verdade.

## Escopo permitido

Preferência local administrativa e componente de atalhos.

## Passos

1. Definir quantidade máxima e chave versionada.
2. Salvar ID após acesso válido.
3. Resolver IDs contra a lista atual.
4. Remover entradas inexistentes/inativas.
5. Testar storage corrompido.

## Critérios de aceite

- Atalho sempre valida a edição antes de abrir.
- Ordem é por acesso recente.
- Dado local não concede permissão.

## Não alterar

Preferência pública de `TSK-036`.
