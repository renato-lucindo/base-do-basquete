---
id: TSK-006
tipo: qualidade
dependencias: [TSK-004, TSK-005]
risco: baixo
---

# Definir fixtures e oráculos de teste

## Objetivo

Criar casos mínimos reutilizáveis para provar isolamento e regras de basquete sem depender de dados de produção.

## Escopo permitido

Somente desenho dos dados de teste e, se houver lacuna comprovada, fixtures em diretório de testes.

## Casos obrigatórios

1. Duas edições e duas categorias com o mesmo jogador.
2. Jogador atuando por equipes diferentes em edições diferentes.
3. Camisas `"00"`, `"0"` e outro número com empate de frequência.
4. Jogo com Q4 empatado e OT.
5. Desqualificação por `2T`, `2U` e `1T+1U`.
6. PDF duplicado por hash.
7. URL válida e combinações inválidas.

## Critérios de aceite

- IDs e datas são determinísticos.
- Cada regra possui resultado esperado calculado manualmente.
- Fixtures não usam credenciais nem dados pessoais reais.

## Não alterar

Dados de produção ou seeds compartilhados sem autorização.
