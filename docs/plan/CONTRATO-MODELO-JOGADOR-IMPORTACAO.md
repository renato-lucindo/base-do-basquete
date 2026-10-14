# Contrato — Modelo de jogador na importação

## Identificação

O jogador possui um identificador próprio independente da equipe.

O número de registro da federação pertence ao jogador.

Regras do registro:

- Campo opcional.
- Possui 6 dígitos quando informado.
- Deve ser único.

## Compatibilidade de jogadores

A busca de jogadores existentes deve seguir esta prioridade:

1. Registro da Federação.
2. Compatibilidade de informações do jogador.
3. Escolha manual do usuário.
4. Criação de novo jogador.

A compatibilidade deve considerar dados como nome, apelido, nascimento e outros dados disponíveis.

## Jogadores com mesmo nome

Quando existirem múltiplos jogadores compatíveis com o mesmo nome, o sistema deve apresentar as opções para escolha manual.

Não criar uma chave baseada somente no nome.

## Dados opcionais

A importação pode preencher:

- apelido;
- nascimento;
- ano de nascimento;
- altura;
- peso;
- posições;
- mão dominante.

## Posições

As posições são opcionais.

O sistema aceita texto de entrada, mas salva somente termos padronizados em português.

Exemplos:

| Entrada | Resultado |
| --- | --- |
| PG | Armador |
| SG | Ala Armador |
| SF | Ala |
| PF | Ala Pivô |
| C | Pivô |

Regras:

- Termos desconhecidos são rejeitados.
- Um jogador pode possuir até duas posições.

