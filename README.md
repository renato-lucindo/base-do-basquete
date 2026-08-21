# Base do Basquete

Aplicação full-stack para dados e histórico de campeonatos de basquete.

O projeto está sendo construído como um monólito modular em TypeScript para Cloudflare Workers, com PostgreSQL, Auth e Storage no Supabase. O navegador acessa somente endpoints da própria aplicação; autenticação, autorização, validações, cálculos e escritas são autoritativos no backend e reforçados no banco.

## Estado

Execução greenfield em andamento por pacotes verticais. Consulte [HANDOFF.md](HANDOFF.md) para o estado atual e [docs/plan/README.md](docs/plan/README.md) para o plano normativo.

## Segurança

- Nenhum segredo é versionado.
- Não existe cadastro público.
- A primeira temporada usa uma única conta administrativa, MFA obrigatório e `aal2`.
- Todas as tabelas expostas usam RLS com negação por padrão.
- O formato de importação é restrito aos boxscores FIBA/Genius Sports documentados.
