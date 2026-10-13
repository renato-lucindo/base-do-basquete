# PR72 — Supabase isolado para QA local

Data:13/10/2026, America/Sao_Paulo. Base Git:bf703423046fe76682b6fdaa4177e00799e2b44d. O banco foi criado na nuvem; os testes foram acionados no computador local. Código, migrations, dependências e workflows da aplicação permaneceram inalterados.

## Projeto, autorização e custo

- Projeto:[base-basquete-pr72-qa](https://supabase.com/dashboard/project/payumtvegfqfejmowxiy), ref payumtvegfqfejmowxiy, região sa-east-1/São Paulo, PostgreSQL17.11.0.003, estado ACTIVE_HEALTHY verificado pelo conector e painel.
- Organização escolhida pelo responsável:renato-lucindo(susztsuwjauudvirutdr). Plano Free confirmado antes/depois da criação; compute NANO; sem upgrade ou adicionais. Responsável confirmou “criação somente gratuita”, US$0/mês; interromper se cota gratuita impedir.
- get_cost e confirm_cost do plugin retornaram UNAVAILABLE. Plano/cota foram verificados no painel e na [documentação oficial](https://supabase.com/docs/guides/platform/billing-faq); confirmação explícita de custo recebida antes do provisionamento. CLI2.118.0 criou o projeto sem alterar plano ou reativar outro projeto.
- Projeto compartilhado yjnbemfeyjhxhomprlnm permaneceu com62 migrations/última20261005140504, conferido read-only ao final. Nenhuma migration foi aplicada nele. PR72 permanece OPEN/DRAFT; sem merge/main ou produção.

## REVIEW_PACKET

```text
WORK_UNIT: MANUAL-SCORESHEET-ISOLATED-QA
BRANCH: codex/manual-stage4-v3-review; upstream origin/codex/manual-scoresheet-v2
BASE_COMMIT: bf703423046fe76682b6fdaa4177e00799e2b44d
HEAD_COMMIT: fixado no comentário REVIEW_PACKET após commit das evidências
OBJETIVO: disponibilizar Supabase Free isolado e executar SQL, Auth/MFA e recuperação lógica sem alterar o compartilhado
CRITERIOS_DE_ACEITE: projeto separado/Free verificado; migrations e fixtures somente no alvo; pgTAP e Auth reais; recuperação delimitada e verificável; segredos protegidos; revisões banco/QA
ESCOPO: provisionamento/testes isolados, logs/runners de evidência, reconciliação e documentação
ESCOPO_NEGATIVO: shared/main, produção, custos/upgrade, alteração de migrations/código/dependências/workflows, dados reais
ARQUIVOS_ALTERADOS: HANDOFF; este relatório; evidence/manual-scoresheet-isolated-qa; acompanhamento da Etapa10
MIGRATIONS: 73 existentes aplicadas somente no novo projeto; nenhuma criada/alterada
RISCOS_CONHECIDOS: projeto baseado no bootstrap Git, não clone da baseline compartilhada; ACLs gerenciadas omitidas na recuperação; Auth/API não é QA visual ao vivo; Actions ainda depende da conta GitHub
TESTES_EXECUTADOS: 49 arquivos/1.418 pgTAP no QA e no restaurado; login/TOTP/AAL2 pela API; backup/restauração e metadados de segurança; sintaxe Python e scan documental
EVIDENCIAS: arquivos/limites abaixo
AMBIENTE_VALIDADO: Windows/Python3.12/psycopg/requests/CLI2.118.0; Supabase Free separado; pg_dump/pg_restore17.11 portáteis oficiais
RISK_LEVEL: CRITICO no domínio de segurança/provisionamento e recuperação de dados
RISK_JUSTIFICATION: execução privilegiada em ambiente de teste próprio; credenciais, Auth, RLS e recuperação exigem avaliação independente
REVIEW_DECISIONS: banco REQUIRED; QA REQUIRED; estatística/UI WAIVED no delta, sem mudança funcional desses artefatos
REQUIRED_REVIEWERS: database-security-reviewer, qa-reviewer
WAIVERS: não repetir build/Vitest/UI antigos, pois aplicação/SQL não mudaram; sem dispensa de revisão de segurança nem de bloqueios anteriores
REVIEW_APPROVER: project-maintainer
WRITE_LOCK_OWNER: project-maintainer
```

## Preparação e pgTAP

As73 migrations locais foram aplicadas por CLI com project-ref explícito do QA e--skip-vault. A seed determinística versionada foi carregada somente nele. A lista de versões aplicada corresponde aos arquivos Git; o compartilhado mantém seu histórico independente.

O comando oficial test db--linked--project-ref tentou iniciar o executor Docker e falhou porque Docker/Podman não estão instalados. O [runner Python](evidence/manual-scoresheet-isolated-qa/pgtap-runner.py) usa psycopg já instalado e conexão TLS verify-full com a [CA oficial do Supabase](https://supabase.com/docs/guides/platform/ssl-enforcement). Não houve desativação de validação TLS.

O runner expande somente os includes locais de fixtures, preserva o SQL dos testes, executa cada arquivo em conexão própria e coleta todos os resultsets. Exige plano TAP único, número/ordem completos de assertivas e ausência de not ok; falha SQL ou TAP resulta em exit1. Restringe project-ref, username e database aos alvos de QA; não aceita alvo arbitrário. BEGIN/ROLLBACK dos testes são preservados; sequences podem avançar mesmo com rollback.

| Execução | Resultado |
| --- | --- |
| Banco QA postgres |49 arquivos/1.418 assertivas PASS; revisões66 |
| Banco restaurado qa_pr72_recovery |49 arquivos/1.418 assertivas PASS |
| SQL/segurança/domínio |Inclui anon, authenticated/AAL1/AAL2, RLS/grants, revisões/CAS, OT, inativos, arquivadas e isolamento estatístico conforme testes versionados |

A primeira execução sem a seed encontrou9 arquivos com fixtures ausentes. A preparação foi corrigida; a execução completa acima passou. Não houve mudança nos testes para obter verde. A execução no restaurado foi uma validação de novo alvo/schema recuperado, justificando repetir a suíte.

Logs:[pgTAP QA](evidence/manual-scoresheet-isolated-qa/pgtap.log), [pgTAP restaurado](evidence/manual-scoresheet-isolated-qa/pgtap-restored.log), [migrations](evidence/manual-scoresheet-isolated-qa/migrations.log). Resultados estruturados no mesmo diretório.

## Auth real e MFA pela API

[Runner](evidence/manual-scoresheet-isolated-qa/auth-runner.py) e [log](evidence/manual-scoresheet-isolated-qa/auth.log):

- Anônimo não executa o probe administrativo.
- Usuário autenticado sintético sem registro administrativo recebe false.
- Administrador em AAL1 é negado na RPC crítica com BD401/BDB_ADMIN_AAL2_REQUIRED.
- Login GoTrue, enrollment TOTP, challenge e verificação geram sessão AAL2 real; probe is_current_admin_aal2 retorna true.
- AAL2 alcança a validação de domínio da RPC; payload inválido continua rejeitado (BD201/BD203), sem criar jogo inválido.
- Conta Auth sintética e singleton administrativo removidos ao final. A seed contém apenas seu usuário sintético sem credenciais de login; nenhum administrador real foi criado.

O teste usa uma identidade example.invalid e senha aleatória distinta da senha do banco; não envia email de confirmação. MFA foi gerado/verificado em memória. A expectativa inicial de HTTP401/403 foi corrigida para o código autoritativo BD401 da RPC, que PostgREST representa como erro de domínio; não se alterou autorização.

Isso comprova login/MFA e autorização pela API. Não equivale a percorrer visualmente todo o wizard em navegador autenticado contra o novo backend. A criação/revisão válida está coberta no SQL; o teste HTTP desta unidade usa deliberadamente payload inválido para validar a fronteira de autorização.

## Backup e recuperação lógica

[Runner](evidence/manual-scoresheet-isolated-qa/recovery-runner.py), [log](evidence/manual-scoresheet-isolated-qa/recovery.log), [resultado](evidence/manual-scoresheet-isolated-qa/recovery-results.json).

pg_dump/pg_restore17.11 foram obtidos do [arquivo oficial EDB](https://www.enterprisedb.com/download-postgresql-binaries) em diretório temporário, sem instalar serviço ou mudar PATH. Backup custom de public/private/auth/storage/extensions/supabase_migrations foi restaurado em outro database dentro da instância QA. Não houve limpeza/reversão do banco original de QA nem do compartilhado.

- Origem estável antes/depois do dump.
- 111 tabelas/545 registros: inventário, contagens e SHA256 do conteúdo integral idênticos no recuperado.
- 73 registros de histórico de migrations recuperados.
- 1.418 pgTAP passaram no recuperado.
- [Verificação adicional de segurança](evidence/manual-scoresheet-isolated-qa/security-results.json):100 relações,165 funções e124 policies da aplicação com os campos selecionados equivalentes; [runner](evidence/manual-scoresheet-isolated-qa/security-runner.py). Comparação cobre flags/opções de relações, SELECT/INSERT/UPDATE/DELETE de anon/authenticated e SELECT de service_role, SECURITY DEFINER/configuração/EXECUTE de anon/authenticated em funções e expressões/roles/comandos das policies em public/private.
- Backup:1.735.342 bytes; SHA256 b28e0b27b710928e9bd816c8d01c023c8d8cc0d8a1fcf3f6bea38e777fb3bf50.

O ensaio precisou corrigir o preparo do destino vazio (schema public existente), incluir storage pela FK de game_data_submissions e tratar permissões gerenciadas. A restauração inicial parou no primeiro DEFAULT ACL de papel interno; a conclusão retomou somente os DEFAULT ACL permitidos. A lista de objetos omitidos e os hashes estão no resultado, sem ocultar essas tentativas.

**Limite explícito:** nove DEFAULT ACL pertencentes a supabase_auth_admin/supabase_admin não podem ser alterados por postgres e foram omitidos do clone de recuperação. O uso de --no-owner também não preserva os proprietários originais dos objetos. A comparação selecionada não cobre owners, USAGE/CREATE de schemas, privilégios de sequences/colunas ou corpos de funções; não comprova equivalência integral de segurança nem default privileges futuros dos papéis gerenciados. A recuperação não cobre configurações externas do GoTrue, secrets, bytes do Storage/S3, Edge Functions, backups gerenciados ou PITR. Não é recuperação integral da plataforma nem clone fiel dos dados históricos compartilhados.

Três databases incompletos deste ensaio foram removidos; permanecem postgres(QA) e qa_pr72_recovery(verificado), dentro do mesmo projeto Free. O dump bruto foi removido após retenção criptografada por Windows DPAPI fora do Git. Somente metadados/hashes/logs foram versionados, nunca conteúdo de backup, tokens ou chaves.

## Credenciais e reprodução

Credencial de banco gerada aleatoriamente e protegida por Windows DPAPI no diretório LOCALAPPDATA/BaseDoBasquete/qa-pr72/database-credential.clixml, acessível ao usuário Windows proprietário. Não registrar sua senha em comandos/documentos. O arquivo temporário com API keys foi removido após Auth; os tokens/TOTP não foram persistidos.

O vínculo da CLI fica somente em TEMP/bdb-pr72-isolated-cli, separado do worktree. Antes de reproduzir, conferir project-ref/username; nunca apontar os runners ao compartilhado. Configurar BDB_QA_PASSWORD somente no processo, BDB_QA_WORKTREE para a raiz e, no teste restaurado, BDB_QA_DATABASE=qa_pr72_recovery; remover variáveis ao terminar. CA pública e ferramentas portáteis ficam em temporários. Para Auth, obter novamente as chaves somente do projeto QA, em arquivo efêmero privado; remover depois. Não imprimir credenciais.

A criação/dump/restore não deve ser repetida automaticamente: o runner recusa sobrescrever destino existente; resume aplica apenas ACLs não gerenciadas em clone já preparado. Para novo ensaio, planejar explicitamente o ciclo de fixture; não remover banco com dados de outro trabalho.

## Advisors e readiness

[Resumo de advisors](evidence/manual-scoresheet-isolated-qa/advisors-summary.json): segurança11 INFO por RLS sem policy em private e53 WARN por funções SECURITY DEFINER executáveis por authenticated; performance22 INFO por FKs,89 INFO por índices ainda sem uso e2 WARN por policies permissivas múltiplas. Não são zero achados; banco independente deve confrontar com guards/RLS e a baseline da aplicação. Links de remediação no resumo. Não alteramos permissões ou índices apenas para esconder avisos.

Projeto isolado e ensaios SQL/Auth/recuperação lógica estão executados; pareceres independentes serão vinculados ao commit fixo. Aplicação/SQL/dependências/workflows não mudaram: gate npm run check68 arquivos/568 testes do preflight permanece aplicável; sem repetir build/Vitest/browser para registro de evidências. Runners novos foram validados por AST Python; evidências passarão por scan de segredos e diff--check.

Merge/rollout permanecem fora do escopo. A indisponibilidade anterior de ambiente foi resolvida. O check remoto de Actions não é substituído ficticiamente por SUCCESS; a cobrança da conta permanece questão separada. Homologação visual autenticada do wizard e recuperação de componentes gerenciados são limites adicionais antes de recomendar produção.

## Revisão e correção dos runners

Banco Harvey revisou 85dc11d0516c504e6a52d07d01cbc42903627d80 em 2026-10-13T12:46:36Z: REQUEST_CHANGES. Confirmou inventários QA73/shared62, testes/limpeza e ausência de delta funcional; encontrou P2 porque Python -O/PYTHONOPTIMIZE elimina assert e pode aceitar TAP inválido. P3: escopo da comparação de segurança amplo demais e aviso de proteção contra senhas vazadas ausente do resumo. Parecer inicial não autoriza encerramento; renovação no commit corrigido é obrigatória.

Correção mínima: os quatro runners recusam sys.flags.optimize antes de imports externos, leitura de credenciais ou conexão. [Regressões offline](evidence/manual-scoresheet-isolated-qa/test_runner_guards.py) passaram: 16 execuções otimizadas (-O/-OO/PYTHONOPTIMIZE=1/2), quatro rejeições de alvo incorreto sem rede e validação TAP real com caso válido e cinco inválidos. Nenhuma credencial real é lida. Os testes remotos anteriores foram executados sem otimização; resultados preservados, sem repetição de SQL/Auth/recuperação.

Advisors de segurança reconsultados read-only em 13/10/2026: além dos11 INFO/53 WARN, auth_leaked_password_protection WARN(1), [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Recurso depende de plano Pro; limitação registrada do QA Free, sem upgrade autorizado/executado. Resumo atualizado; avisos de performance mantêm o snapshot anterior.

QA Archimedes não concluiu a revisão inicial por erro de capacidade do serviço; isso não constitui aprovação. Reenvio da revisão independente após a correção, sem alteração de modelo. Actions de85dc11d: CI38398920897, Preview38398920879, CodeQL38398921059 e Stage438398912451 FAILURE, sem etapas iniciadas, annotation de cobrança verificada. Não confundir com testes executados e reprovados.
