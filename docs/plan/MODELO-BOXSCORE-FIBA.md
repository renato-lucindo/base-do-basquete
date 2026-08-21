# Modelo oficial de boxscore

## Escopo

O importador deve ser desenvolvido exclusivamente para o modelo **Box Score FIBA / Genius Sports** representado pelos dois PDFs incluídos em `referencias/modelos-boxscore/`.

Fixtures oficiais:

- `Box Score FIBA IVV vs CAC 06 maio.pdf`
- `Box Score FIBA ALC vs AVA 09 maio.pdf`

## Orientações

- Considerar os dois PDFs variações válidas do mesmo layout.
- Não criar parser genérico para outros modelos de boxscore.
- Não ampliar o escopo para súmula oficial completa.
- Não implementar OCR no plano atual.
- Usar a camada de texto e a posição dos elementos; não depender somente da sequência linear do texto extraído.
- Tratar campos opcionais sem rejeitar o documento inteiro.
- Manter revisão administrativa antes do commit.

## Conteúdo esperado

- competição, data, horário, local, número e duração do jogo;
- equipes, abreviações, placar final e placar por período;
- pontuação acumulada a cada cinco minutos;
- número, nome, minutos e situação `NJ` de cada jogador;
- titular `*` e capitão `(C)`;
- arremessos, 2 pontos, 3 pontos e lances livres;
- rebotes, assistências, erros, bolas recuperadas, tocos e faltas;
- mais/menos, eficiência, pontos, totais e indicadores complementares.

## Variações obrigatórias

- nomes ocupando uma ou mais linhas;
- camisa `00`;
- jogador marcado como `NJ`;
- valores negativos;
- percentuais com vírgula decimal;
- quantidade diferente de jogadores;
- campos de arbitragem ou comissão técnica ausentes;
- titular e capitão combinados ao nome ou número.

## Aceite

O mesmo parser deve extrair os dois PDFs, produzir um contrato normalizado comum e reconciliar placar, pontos e totais antes da revisão administrativa.
