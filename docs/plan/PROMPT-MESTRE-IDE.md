# Prompt mestre para a IDE

Execute integralmente este plano como uma reconstrução greenfield e autônoma da **Base do Basquete**.

O único elemento de identidade já definido é o nome **Base do Basquete**. O domínio próprio ainda não foi escolhido: não pesquisar, registrar, comprar ou configurar domínio sem uma definição posterior do responsável. Até lá, usar somente URLs temporárias de preview fornecidas pela plataforma.

## Mandato

Você está autorizado a:

- criar e configurar o repositório privado no GitHub;
- criar branches, commits, pull requests, workflows, environments e secrets;
- integrar PRs quando todos os gates obrigatórios estiverem verdes;
- criar e configurar Workers, previews, rotas, variáveis e secrets no Cloudflare;
- criar e configurar projetos, banco, migrations, Auth, Storage, RLS e funções no Supabase;
- utilizar o navegador nos ambientes GitHub, Cloudflare e Supabase quando uma ação exigir interface gráfica;
- tomar decisões técnicas reversíveis usando os padrões deste pacote, sem solicitar validação prévia;
- consultar documentação oficial atual antes de usar recursos cuja API, versão ou configuração possa ter mudado.

Não interrompa a execução para pedir preferências cosméticas, nomes internos, pequenas escolhas de biblioteca, confirmação de cada migration, aprovação de cada PR ou validação manual que possa ser automatizada.

## Limites da autorização

Interrompa apenas quando for indispensável:

- login, MFA, CAPTCHA ou consentimento que a ferramenta não possa concluir;
- aquisição ou upgrade pago;
- transferência ou comprovação de domínio/organização;
- exclusão irreversível ou transformação destrutiva de dados de produção;
- decisão de produto sem padrão definido neste pacote e com impactos incompatíveis entre as alternativas.

Nesses casos, faça todas as etapas anteriores possíveis e solicite somente a ação humana exata que falta.

## Segurança obrigatória

Considere o frontend completamente não confiável. Toda autenticação, autorização, validação, cálculo, transição de estado, idempotência e transação deve ser aplicada no backend e, quando possível, reforçada no PostgreSQL.

O frontend não pode importar ou inicializar cliente Supabase, conexão de banco, SDK administrativo ou credencial de serviço. O navegador chama somente endpoints do domínio da aplicação.

Nunca exponha, imprima ou versione segredos. Se encontrar um segredo em código, log ou histórico, trate-o como comprometido, revogue-o e rotacione-o sem reproduzir seu valor.

Na primeira temporada haverá somente uma conta administrativa. Implemente apenas autenticação dessa conta, MFA, `aal2`, autorização no backend, RLS, proteção de segredos e auditoria essencial. Não implemente cadastro público, convites, múltiplos administradores, RBAC, papéis, gestão de usuários ou painel de permissões. Preserve uma arquitetura evolutiva e registre esses itens como backlog futuro, sem construir antecipadamente.

## Forma de trabalho

1. Leia todos os documentos ativos deste pacote, incluindo `AGENTS.md` e `HANDOFF.md`.
2. Crie o repositório, coloque `AGENTS.md` e `HANDOFF.md` na raiz e registre as decisões arquiteturais no próprio GitHub.
3. Execute `PLANO-EXECUCAO.md` por pacotes verticais.
4. Use um PR por pacote de trabalho, com commits lógicos por camada.
5. Rode um gate consolidado ao final de cada pacote.
6. Corrija automaticamente as falhas encontradas.
7. Registre evidências curtas em `docs/execution/WP-XX.md`.
8. Integre o PR quando o gate estiver verde e prossiga para o próximo pacote liberado.
9. Mantenha preview funcional desde o primeiro pacote publicável.
10. Não implemente o OCR futuro; apenas preserve o ponto de extensão descrito em `FUTURO-OCR.md`.

## Continuidade, Git e publicação

- Trabalhe em branch curta específica do pacote WP.
- Faça commits pequenos após unidades funcionais coerentes, nunca a cada arquivo isolado.
- Antes do push, execute os testes proporcionais à mudança e a varredura de segredos.
- Se a sessão precisar encerrar com trabalho incompleto, deixe-o consistente, identifique o commit como WIP, atualize `HANDOFF.md` e faça push somente para a branch do WP.
- Nunca faça merge de WIP na branch principal.
- Integre na branch principal somente após o gate consolidado aprovado.
- Não vincule produção a pushes comuns de branches de trabalho. Deploy de produção deve partir exclusivamente da branch principal protegida ou de versão marcada, após os gates.
- Ao encerrar uma sessão, registre no `HANDOFF.md` branch, commit, testes, pendências e o próximo passo exato. Não dependa de perceber antecipadamente um limite de tokens para preservar o trabalho.

## Critério de conclusão

Não considere o projeto concluído apenas porque a interface funciona. A entrega final exige segurança comprovada por chamadas diretas ao backend, testes de RLS, aplicação das migrations desde zero, build reproduzível, preview, smoke test de produção e ausência de segredos nos artefatos públicos.
