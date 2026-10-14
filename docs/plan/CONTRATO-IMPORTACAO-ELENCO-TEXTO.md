# Contrato — Importação de elenco por texto

## Objetivo

Permitir que uma equipe seja carregada a partir de um texto simples contendo jogadores e informações opcionais. O sistema deve interpretar os dados, apresentar uma etapa de conferência e somente depois criar ou vincular jogadores.

## Formato de entrada

Formato esperado:

```text
Equipe: Lobos

4- João
12- Ricardo - 193 - 1999
23- Mike - "MJ" - 2000 - SG
77- Luke Silva - 180 - 75kg
```

Regras:

- Nome do jogador é obrigatório.
- Número da camisa é opcional.
- Número de registro da federação é opcional.
- Demais informações são opcionais.
- O texto pode possuir jogadores com quantidades diferentes de informações.

## Campos reconhecidos

| Campo | Obrigatório |
| --- | --- |
| Nome | Sim |
| Número da camisa | Não |
| Registro da Federação | Não |
| Apelido | Não |
| Posição | Não |
| Data de nascimento | Não |
| Ano de nascimento | Não |
| Altura | Não |
| Peso | Não |
| Mão dominante | Não |

## Confirmação antes da gravação

O sistema deve gerar uma tabela de revisão:

| Nº | Nome | Situação |
| --- | --- | --- |
| 4 | João | Encontrado ou criar novo |
| 12 | Ricardo | Criar novo jogador |

Nenhum jogador deve ser criado automaticamente sem confirmação.

