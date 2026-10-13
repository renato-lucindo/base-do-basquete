# Súmula por teclado — MVP

Unidade `MANUAL-KEYBOARD-MVP`, branch `codex/keyboard-scoresheet-mvp`, base `27d917a1ce4a404ced091fd3ca660113c215ca92`.

## Comportamento

Na inclusão de súmula, escolher o jogo e “lançar por teclado”. Conferir os relacionados e as camisas da partida. A identidade é jogo + equipe + camisa, distinguindo 0 e 00. A nova tela e o motor são independentes do editor anterior.

Dois campos: camisa, Enter, cesta (1/2/3) ou falta, Enter. Espaço alterna os dois modos; barra invertida alterna equipes; setas no campo de camisa vazio mudam períodos; F2 edita o último registro; Esc cancela; Ctrl+Z desfaz; Ctrl+Shift+Z/Ctrl+Y refaz. Os controles nativos oferecem as mesmas ações pelo teclado. Histórico inteiro editável e exclusão individual; a edição permite trocar equipe, camisa, ação e período. As fontes dos registros conservam vermelho em Q1/Q3 e azul em Q2/Q4/OT. Até oito OTs.

Pontos são acertos, nunca tentativas. LL cobrados são a soma absoluta das penalidades adversárias; cedidos são as próprias penalidades; compensadas não geram cobrança, mas contam como faltas/GD. Sem percentuais no MVP, individuais ou coletivos.

## Regras e limitações explícitas

Contrato versionado `FIBA_2024`, para a notação P/T/U/D pedida. Fontes primárias: [Regras FIBA 2024, arts. 36–42 e apêndice B.8](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2024-v10a.pdf). Regras 2026 têm semântica diferente e precisam de perfil próprio; não se reinterpretam jogos históricos automaticamente.

Técnicas usuais T1/C1/B1; “c” compensa a penalidade. B2 é penalidade por desqualificação de pessoa de banco e não incrementa o contador de técnicas comuns do técnico. C representa o técnico principal, não qualquer integrante da comissão. D no alvo C identifica sua desqualificação direta. Cinco faltas excluem; D e combinações T+T/U+U/T+U desqualificam. C+C ou três B/C desqualificam o técnico; atleta-treinador combina as duas linhas. Registro de pontos e faltas são transcritos em lotes; a ordem de digitação entre os modos não afirma cronologia de cada lance no mesmo período.

Este MVP transcreve as penalidades já decididas na súmula, sem apitar o jogo, inferir posse, identificar envolvidos de brigas ou reconstruir a cronologia dos lances. B2 conserva a penalidade de banco; o detalhamento nominal de integrantes não relacionados e as marcações F de brigas requerem evolução específica. Perfil manual obrigatório; o fallback em edição de PDF continua no fluxo existente. Correção de confronto esportivamente resolvido exige revisar sua resolução antes de alterar os resultados. A relação de atletas fica fixa após a primeira confirmação. Jogos legados sem eventos continuam no editor existente; não são convertidos em eventos artificiais.

## Persistência e convivência

Rascunho remoto após edição, em JSON versionado, com revisão imutável, autor/data, request UUID e CAS. Fila serial de gravação; reenvio reutiliza conteúdo e identidade; conflito entre abas exige conciliação explícita e permite exportação local. Falha de rede preserva histórico editável e cópia local. O navegador não recebe cliente Supabase. Sessão AAL2 e CSRF no servidor; RLS/GRANTs e autorização na RPC.

Confirmar projeta uma única vez em entidades canônicas compartilhadas. Revisar requer motivo, cria nova submissão, preserva snapshots e troca as seis autoridades manuais. As projeções são substituídas, não somadas. Nenhum draft afeta estatísticas oficiais. Writer antigo é bloqueado em jogo reservado; writer novo rejeita jogo confirmado por outra fonte. Escritas diretas autenticadas nas projeções de jogos reservados são recusadas. PDF/reconciliação mantém seu protocolo existente.

Tentativas individuais ficam NULL. Mudança de submissão invalida o fingerprint público; a revisão, mesmo sem alteração do placar, muda o snapshot editorial e depende de republicação explícita. Publicação e produção não são automáticas.

## Verificação

Domínio focal: 26 cenários, incluindo camisas por equipe, compensadas/GD, B2, atleta-treinador, undo/redo, movimentação de períodos, LL, duas OTs, DNP e desqualificação direta nas duas funções do atleta-treinador. Quatro testes de API exercitam CSRF/origem, validação de alvo e CAS. Playwright: oito cenários de digitação, foco, correção de equipe sem duplicação, undo durante edição, erro de camisa acessível, recuperação, falha de rede e axe/reflow em 390/720/1440 nos dois temas.

pgTAP focal: 39 assertivas, incluindo participação no denominador público, barreiras de escrita direta na origem/destino e manutenção das seis autoridades. O replay nativo executa todas as migrations/seed e a suíte integral. O teste estático do wrapper legado foi atualizado para verificar sua delegação ao contrato preservado; o teste funcional de fallback permaneceu intacto. Concorrência real: CAS com um vencedor; duas chamadas simultâneas com a mesma identidade retornam o mesmo recibo; writer novo versus legado tem um único vencedor.

Reprodução sem Docker: iniciar PostgreSQL 17 descartável em loopback:55477 com pgTAP, definir `PG_BIN` e executar `python scripts/test-keyboard-postgres.py --all`. Para as três disputas concorrentes, definir `PGDATABASE` com o nome `keyboard_mvp_*` impresso pelo runner e executar `python scripts/test-keyboard-concurrency.py`. O bootstrap Auth/Storage é uma compatibilidade mínima para testar SQL/RLS; **não substitui GoTrue/PostgREST nem o gate Supabase de CI**. Artefatos e resumos ficam em `tmp/keyboard-native-results`; preservar o resumo verificado em Git/PR.

Os Actions da PR77 não iniciaram por bloqueio de cobrança/limite de gastos informado pelo GitHub; nenhuma alteração de cobrança foi realizada. Resultados finais/SHAs/pareceres ficam no HANDOFF e na PR, sem presumir aprovação remota.
