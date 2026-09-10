# MVP-03 — Administração e criação por presets

## Estado

`DOING` na branch `feature/admin-workflow-improvements`, PR draft #35.

## Baseline

- Head de partida `3658f59`, worktree limpo.
- Checks `gate`, `database`, `analyze` e `upload` aprovados no fechamento documental do MVP-02.
- Não houve nova migration nem escrita no Supabase nesta unidade.

## Unidade implementada

- Hub com accordion controlado: todas as equipes recolhidas inicialmente, apenas uma aberta e retorno ao elenco salvo pelo parâmetro existente `savedRoster`.
- Seções Elenco/Situação/Resultado mostram um formulário por vez; componentes permanecem montados para preservar estado ao alternar.
- Cabeçalho acionável por teclado, relações ARIA, situação em português e estilos móveis com quebra de texto.
- A ação de súmula agora informa corretamente que seleciona um jogo existente.
- Allowlist desta unidade: componente/teste do accordion, rota do hub, CSS, fila e documentação do pacote.

## Segunda unidade — áreas administrativas

- `/admin` redireciona após AAL2 para `/admin/competitions`; equipes, atletas e segurança possuem rotas próprias e navegação compartilhada com o hub.
- Competições têm busca server-side, filtros por ano/situação e naipe explícito; formulários globais saíram desta página.
- Equipes e atletas têm buscas limitadas a 50 resultados; cada action aceita somente sua própria operação e preserva AAL2, mesma origem, CSRF e as validações/RPCs existentes.
- Segurança reúne estado da sessão e encerramento de sessões pelo endpoint existente.
- Allowlist ampliada para as novas rotas, `app/routes.ts`, entrada administrativa, navegação compartilhada e testes de isolamento das áreas.
- Gate local aprovado: 30 arquivos/117 Vitest, formatação/lint, tipos, runbooks, builds e scan de segredos. Os 13 testes novos cobrem negação antes de consultar/gravar, origem, CSRF, isolamento de intents e continuidade do cadastro privado.
- Commit `bc60d76` enviado somente à branch da PR #35. CI/database `34473818965`, preview `34473818938` e CodeQL `34473818894` aprovados.
- Reconciliação remota somente leitura: 4 revisões de regulamento, 9 jogos e `game_active_data_sources` disponível. O smoke administrativo foi redirecionado ao login: MFA renovado é necessário para QA interativo, mas não para desenvolver os presets localmente.

## Validação

### Terceira unidade — compilação dos presets (10/09/2026)

- Login renovado: as quatro áreas carregaram em AAL2. Busca de equipes por `Alcateia` retornou apenas a equipe correspondente. No hub da edição 20, abrir AVABES recolheu Alcateia; alternar Elenco/Situação manteve apenas a seção selecionada visível. Nenhum formulário foi submetido e a sessão não foi encerrada. Viewports 390/768/desktop e teclado integral ainda pendentes.
- Compilador puro TypeScript e equivalente PostgreSQL interno, versionados em v1, com grupo único e eliminatória simples para 2..16 posições explicitamente atribuídas. Limite conservador desta versão; ampliar exige nova versão testada, não inferência ou truncamento. Não há atribuição automática de equipes a posições a partir de nomes/classificação.
- Grupo único usa rotação determinística e cada par se enfrenta uma vez. Eliminatória reserva referências tipadas a vencedores anteriores; folgas das primeiras posições não criam confrontos ou jogos fictícios. Contratos reservados são tipados, não derivados de rótulos.
- Validador de domínio recusa origens inexistentes/futuras/cíclicas, entradas/saídas repetidas, partidas excedentes, terceiro confronto de semifinal e segundo de final. O compilador SQL aceita apenas chave/capacidade e não recebe grafo livre do cliente.
- SQL em schema privado, `SECURITY INVOKER`, `search_path` vazio e execução revogada para PUBLIC/anon/authenticated. Sem novo endpoint público ou alterações em registros históricos.
- Allowlist ampliada: dois módulos de domínio/teste, migration gerada pelo CLI e pgTAP focal, além deste relatório e HANDOFF.
- Gate local: 31 arquivos/177 Vitest, formatação/lint, TypeScript, quatro runbooks, build cliente/SSR e scan de 504 arquivos. Ensaio SQL em transação: 18/18 pgTAP. Comparação integral TypeScript/PostgreSQL: 30 configurações com paridade exata. Rollback confirmado; 9 jogos e 4 revisões preservados.
- `20260910123720_mvp03_preset_compiler.sql` **não aplicada persistentemente**. A saída JSON é somente blueprint interno; a próxima unidade materializa referências por FKs e aplica a autoridade transacional. Presets ainda não estão disponíveis para criação de edições na UI.

- Gate local completo aprovado em 10/09/2026: formatação/lint, TypeScript, 29 arquivos/104 Vitest, quatro runbooks, build cliente/SSR e varredura de 493 arquivos sem segredos.
- QA focal autenticado do accordion concluído; responsividade integral e gate consolidado do pacote ainda pendentes. Esta unidade não conclui MVP-03.

## Próximo passo

### Unidade integrada — criação privada e wizard

- Schema aditivo: trilhas, grupos, entradas, vagas por FKs exclusivas, folgas e contratos locais de rodadas/confrontos. As colunas legadas de participantes continuam existindo; só as estruturas novas podem reservar vagas ainda indefinidas.
- A ativação reconstrói o blueprint a partir das FKs e exige igualdade com o compilador versionado. Revisão ativa e seus filhos são imutáveis, inclusive contra troca de contexto. Vagas só aceitam vencedores de rodadas anteriores. Semifinais são limitadas sob bloqueio da revisão/rodada. Jogos indefinidos ou excedentes são recusados.
- RPC AAL2 cria perfil (se necessário), edição privada, revisão/estrutura e auditoria na mesma transação. Chave de idempotência + bloqueios de ano/perfil e comparação do perfil esperado protegem reenvio e alterações concorrentes. Novas edições não aceitam INSERT direto pelo papel autenticado.
- Wizard com Identificação → Dados e formato → Revisão. Resumo calculado no servidor; a confirmação revalida os dados e chama apenas a RPC. CSRF, mesma origem e AAL2 obrigatórios. Nenhum grafo arbitrário é recebido do frontend. Criação termina no hub da edição.
- 39 novos testes de domínio/rota (216 Vitest no total). Gate completo local aprovado. 35 pgTAP em rollback aprovados, incluindo 30 configurações persistidas/reconstruídas, privacidade, idempotência, AAL1/anon/não-admin, imutabilidade, terceiro confronto de semifinal e origens inválidas. Ensaio não deixou edições ou estruturas persistidas.
- Allowlist ampliada: nova migration/pgTAP, domínio/testes de criação, rota/teste do wizard, roteamento, link na listagem, CSS do wizard e assinatura RPC nos tipos. Regenerar tipos integralmente após aplicar schema aprovado.

Conferir CI/preview, aplicar as duas migrations somente após verde e reconciliar dados/advisors/tipos. Validar wizard no navegador e executar teste simultâneo de concorrência, além de 390/768/desktop. O pacote permanece em execução até seu gate completo.
