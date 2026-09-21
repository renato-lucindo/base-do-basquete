# Gates otimizados

## Durante a implementação

Executar somente testes focais afetados, verificação de tipos e consultas transacionais com rollback. Não aguardar todos os workflows remotos após cada commit intermediário.

## Antes do push do pacote

1. formatação e lint;
2. TypeScript estrito;
3. testes unitários e de domínio afetados;
4. pgTAP focal e regressões diretamente relacionadas;
5. build Worker;
6. varredura de segredos;
7. `git diff --check`;
8. atualização do HANDOFF.

## Depois do push do pacote

Um único ciclo consolidado deve aprovar:

- gate da aplicação;
- banco desde zero;
- análise de segurança;
- preview;
- smoke focal do fluxo entregue.

Migrations de banco são ensaiadas primeiro em transação com rollback. Aplicação persistente ocorre somente após o ciclo remoto verde, seguida de reconciliação de contagens/checksums e advisors.

## Gate de release do MVP

- Fluxo completo: criar edição privada → equipes/elenco → estrutura → agendar → súmula ou PDF → publicar → consultar anonimamente.
- AAL2 permite e AAL1/usuário comum/anon negam operações administrativas.
- Nenhum PDF, sexo privado ou conteúdo não publicado aparece no tráfego público.
- 390 px, 768 px e desktop; teclado; foco; zoom 200%; estados vazio/erro/carregamento.
- Os dois PDFs FIBA, o PDF Basketball Site e ao menos uma súmula manual passam.
- Migrações desde zero, base representativa, advisors e checksums passam.
- Release candidata pode ser publicada por versão; produção nunca recebe WIP.

## Gate pós-MVP

Somente `POST-04` fecha integralmente os critérios originais de `ADM-REF-09A–09C`.
