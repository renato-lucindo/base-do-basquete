# AGENTS.md — Base do Basquete

## Missão

Construir e manter autonomamente a **Base do Basquete**, uma aplicação web de dados e histórico do basquete. O projeto é uma reconstrução greenfield: não depende de repositório ou infraestrutura anterior.

Este arquivo vale para todo o repositório. Instruções mais específicas em subdiretórios podem complementar estas regras sem enfraquecer segurança, integridade dos dados ou decisões de produto registradas.

## Agentes especializados

As definições operacionais ficam em `.agents/`:

- `.agents/agent-contract.md`: contrato compartilhado, write lock, review packet e validade dos pareceres;
- `.agents/project-maintainer.md`: único agente escritor da unidade ativa;
- `.agents/database-security-reviewer.md`: revisão especializada de banco e segurança, sem mutação;
- `.agents/qa-reviewer.md`: revisão independente de qualidade e release, sem mutação.

Todo agente especializado deve obedecer primeiro a este `AGENTS.md` e ao `HANDOFF.md`. As instruções de `.agents/` complementam estas regras sem substituí-las.

## Início obrigatório de cada sessão

Antes de alterar arquivos ou serviços:

1. Leia este `AGENTS.md` integralmente.
2. Leia `HANDOFF.md` e os documentos ativos em `docs/plan/` na ordem indicada pelo README do plano.
3. Execute `git status` e `git log --oneline -10`.
4. Compare o handoff com o estado real do repositório e dos serviços remotos.
5. Se houver divergência, preserve o trabalho existente, corrija o `HANDOFF.md` e só então prossiga.
6. Continue pelo **Próximo passo exato**. Não reinicie o projeto nem refaça itens concluídos e verificados.

## Fonte da verdade e ambientes

- GitHub: código, migrations, documentação, decisões, histórico, CI e evidências.
- Cloudflare Workers: aplicação, previews e produção.
- Supabase: PostgreSQL, Auth e Storage.
- Workspace local: somente apoio efêmero; nada essencial pode existir apenas localmente.
- Domínio próprio: ainda não definido. Não pesquisar, comprar, registrar ou configurar domínio sem nova instrução do responsável.

A execução pode usar navegador autenticado no GitHub, Cloudflare e Supabase quando API, CLI ou conector não forem suficientes. Solicite intervenção humana apenas para login, MFA, CAPTCHA, pagamento, escolha de domínio, consentimento indelegável ou ação destrutiva em produção.

## Forma de execução

- Siga os pacotes verticais de `docs/plan/PLANO-EXECUCAO.md` e suas dependências.
- Use branch curta e PR por pacote quando o repositório e o plano da conta permitirem.
- Tome decisões técnicas reversíveis sem pedir confirmação; registre decisões relevantes e continue.
- Não pare após planejamento ou scaffold: implemente, teste, publique e valide o pacote atual.
- Ao final de cada pacote, execute um gate consolidado com lint, formatação, typecheck, testes afetados, testes SQL/RLS, build, verificação de segredos e preview/smoke quando aplicável.
- Corrija automaticamente falhas reversíveis. Declare bloqueio somente após investigar e esgotar alternativas seguras.
- Consulte documentação oficial atual antes de implementar integrações ou configurações que possam ter mudado.

### Verificação eficiente

- Durante a implementação, execute somente testes focais dos arquivos, módulos e migrations alterados.
- Execute o gate local completo uma única vez quando a unidade estiver estável, imediatamente antes do push.
- Não repita build, suíte completa ou varredura de segredos quando nenhum código, migration, dependência ou configuração relevante mudou desde a evidência verde.
- Para banco, use pgTAP focal durante a iteração e a suíte integral apenas no gate de merge/release.
- Consulte CI e deploy por resumos compactos de status. Leia logs completos somente quando houver falha ou divergência.
- Restrinja QA de navegador aos fluxos e viewports afetados; reutilize evidência recente quando o artefato correspondente não mudou.
- O fluxo econômico reduz repetição, não reduz os gates obrigatórios de merge e produção.

## Arquitetura e segurança obrigatórias

- TypeScript estrito e monólito modular full-stack.
- Frontend é sempre não confiável e serve apenas para apresentação e entrada de dados.
- Autenticação, autorização, validação, regras, cálculos, transições, idempotência e gravações são autoritativos no backend e, quando aplicável, reforçados no PostgreSQL.
- O frontend não pode inicializar cliente Supabase, conexão de banco, SDK administrativo nem receber credencial privilegiada.
- Nunca exponha ou versione secrets, tokens, cookies, chaves, `service_role`, connection strings ou credenciais. Registre somente nomes de variáveis.
- Habilite RLS em todas as tabelas expostas desde a criação e teste acesso anônimo, autenticado não autorizado e administrativo.
- Não confie em `user_metadata` para autorização.
- Escritas críticas devem ser transacionais, validadas no servidor e idempotentes.

## Administrador da primeira temporada

- Haverá uma única conta administrativa, pertencente ao responsável do projeto.
- Implementar Supabase Auth, MFA obrigatório, `aal2`, sessão segura, autorização server-side, RLS e auditoria essencial.
- Não implementar agora cadastro público, convites, múltiplos administradores, RBAC, papéis, gestão de usuários ou painel de permissões.
- Registrar esses recursos apenas como evolução futura, sem antecipar sua implementação.

## Importação de dados

- A importação atual aceita exclusivamente o modelo único de boxscore FIBA/Genius Sports descrito em `docs/plan/MODELO-BOXSCORE-FIBA.md`.
- Os dois PDFs fornecidos são fixtures obrigatórias do mesmo parser.
- Não criar parser genérico, importação de súmula oficial completa ou OCR nesta etapa.
- OCR open source permanece somente como alternativa futura documentada.

## Git e preservação do trabalho

- Nunca descarte, sobrescreva ou reorganize mudanças existentes sem identificar sua origem.
- Não use comandos destrutivos para limpar o repositório.
- Faça commits pequenos e coerentes, sem segredos e com mensagens claras.
- Trabalhe em uma branch curta para cada pacote WP; não faça desenvolvimento direto na branch principal.
- Antes do push, execute os testes aplicáveis e a varredura de segredos.
- Se a sessão precisar terminar com uma unidade incompleta, deixe o estado consistente, atualize o handoff, use commit claramente identificado como WIP e faça push somente para a branch do WP.
- Nunca integre WIP na branch principal.
- Faça merge somente quando o gate consolidado estiver aprovado.
- Produção deve ser publicada somente pela branch principal protegida ou por versão marcada; pushes em branches WP podem gerar apenas preview.
- Mantenha migrations e lockfile versionados.
- Não declare algo concluído sem verificação proporcional ao risco.

## HANDOFF obrigatório

Atualize `HANDOFF.md`:

- ao concluir ou bloquear um pacote de trabalho;
- após decisão arquitetural, migration ou incidente relevante;
- quando o estado do Git, ambiente ou deploy mudar de modo importante;
- antes de trocar de sessão/conta/agente ou encerrar o trabalho.

Para evitar burocracia, não atualize o handoff a cada pequeno arquivo. Nenhuma informação essencial pode permanecer apenas na conversa.

O **Próximo passo exato** deve indicar arquivo ou serviço, ação concreta e validação esperada. Nunca escreva apenas “continuar implementação”.

## Encerramento de sessão

Antes de encerrar:

1. Termine a menor unidade segura em andamento.
2. Deixe código e serviços em estado consistente.
3. Execute os testes possíveis e registre resultados reais.
4. Execute `git status`.
5. Atualize `HANDOFF.md`, inclusive bugs, alterações não commitadas e próximo passo exato.
6. Faça commit e push quando apropriado e seguro.

A sessão está corretamente encerrada quando outro Codex consegue continuar usando apenas o repositório e os acessos autorizados.
