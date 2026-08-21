# Alternativa futura de OCR

## Estado

Backlog futuro. Não implementar, escolher biblioteca, instalar dependência ou criar infraestrutura de OCR durante o plano atual.

## Objetivo futuro

Permitir que boxscores digitalizados sem camada de texto possam passar por reconhecimento óptico antes do parser existente.

## Comportamento atual

- PDF com camada de texto segue pelo importador de boxscore.
- PDF sem camada de texto é recusado de forma segura e encaminhado para a súmula manual.
- O sistema registra somente que OCR poderá ser oferecido futuramente.

## Preparação permitida agora

Manter uma interface de extração desacoplada, capaz de receber PDF e retornar texto estruturado ou erro. A implementação atual usa apenas extração de texto nativa do PDF.

## Direção futura

Quando priorizado, avaliar um mecanismo open source hospedado no backend, potencialmente obtido de repositório público, capaz de operar com português, tabelas e PDFs digitalizados. O processamento deve ocorrer fora do navegador, preferencialmente de forma assíncrona, mantendo revisão humana antes do commit.

Nenhuma solução específica foi selecionada neste plano.
