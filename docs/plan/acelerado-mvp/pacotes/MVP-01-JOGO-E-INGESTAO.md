# MVP-01 — Jogo estrutural e ingestão principal

- **Estado atual:** `DONE`
- **Incorpora:** `02D`, `03A`, `03B`, `03C`, `02E`
- **Meta:** 1–2 janelas.

## Entregar

- Estrutura mínima versionada com `legacy_unclassified` e vínculo opcional íntegro entre jogo e confronto.
- Comparador puro de participantes, placar, períodos, pontos, cestas e avisos de camisa.
- Súmula manual confirmada no jogo existente, transacional e idempotente.
- PDF FIBA/Genius Sports confirmado no jogo existente usando as duas fixtures, sem escrita parcial e com PDF privado.
- Autoridades compatíveis ativadas pelo banco.
- Depois de adaptar ambos os fluxos, impedir novos jogos fora de confronto válido; histórico continua legível.

## Corte consciente

Fallback manual, suplemento boxscore e tela de conflito ficam em `POST-01`. Divergência no MVP deve permanecer em `review` com erro localizado e sem promover dados automaticamente.

## Gate

Banco desde zero, pgTAP de integridade/RLS/concorrência, testes puros, duas fixtures PDF, uma súmula, idempotência, nenhuma criação paralela de jogo, checksums históricos e preview administrativo.

## Concluído quando

Um jogo estrutural aceita exatamente uma confirmação principal manual ou FIBA, repetições são seguras e nenhum fluxo novo contorna o confronto.
