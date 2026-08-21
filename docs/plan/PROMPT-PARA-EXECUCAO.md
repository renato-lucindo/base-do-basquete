# Prompt para iniciar a execução

Anexe este ZIP a uma nova tarefa do Codex e envie o texto abaixo:

> Extraia este pacote e leia integralmente `README.md`. Crie o novo repositório privado, coloque `AGENTS.md` e `HANDOFF.md` na raiz e importe os demais documentos para `docs/plan/`. Depois leia tudo na ordem obrigatória e execute o projeto **Base do Basquete** do zero até a publicação, conforme `PROMPT-MESTRE-IDE.md`, `POLITICA-AUTONOMIA-CLOUD.md` e `PLANO-EXECUCAO.md`.
>
> Trabalhe com máxima autonomia e persistência. Crie e configure sozinho o repositório privado no GitHub, CI/CD, Cloudflare Workers, previews, Supabase PostgreSQL/Auth/Storage, migrations, RLS, testes, observabilidade e deploy. Use o navegador autenticado, quando necessário, exclusivamente no GitHub, Cloudflare e Supabase. Não peça validações intermediárias para decisões técnicas reversíveis; decida, registre e continue. Só me interrompa quando for indispensável uma ação humana que você realmente não possa concluir, como login, MFA, CAPTCHA, pagamento, escolha posterior do domínio ou ação destrutiva em produção. Nesses casos, faça antes tudo o que for possível e peça apenas a ação exata que falta.
>
> Considere todo frontend não confiável. Execute autenticação, autorização, validações, cálculos, regras, idempotência e gravações no backend e reforce-as no banco. Não exponha URLs internas, connection strings, tokens, secrets, service role, chaves ou credenciais no frontend, repositório, logs ou respostas. O navegador deve chamar somente endpoints da própria aplicação.
>
> Na primeira temporada haverá uma única conta administrativa, a minha. Implemente Supabase Auth, MFA obrigatório, `aal2`, sessão segura, autorização server-side, RLS e auditoria essencial. Não implemente agora cadastro público, convites, múltiplos administradores, RBAC, papéis, gestão de usuários ou painel de permissões; deixe isso apenas no backlog futuro.
>
> A importação aceita exclusivamente o único formato de boxscore FIBA/Genius Sports documentado em `MODELO-BOXSCORE-FIBA.md`. Use os dois PDFs incluídos como fixtures obrigatórias do mesmo parser. Não implemente súmula oficial completa, parser genérico nem OCR agora; OCR open source é apenas alternativa futura.
>
> O nome do projeto é **Base do Basquete**. Nenhum domínio foi definido: não pesquise, registre, compre ou configure domínio; use as URLs temporárias das plataformas. GitHub e os serviços cloud são a fonte da verdade; não deixe infraestrutura ou artefato importante existindo apenas localmente.
>
> Avance pacote por pacote, execute o gate consolidado, corrija falhas automaticamente, registre evidências no GitHub e continue até cumprir os critérios de conclusão. Não encerre após criar apenas um plano ou scaffold: implemente, teste, publique e valide o sistema completo.
>
> Para preservar continuidade, trabalhe em branch própria de cada WP, faça commits após unidades funcionais coerentes e pushes seguros para essa branch. Antes do push, execute os testes aplicáveis e varredura de segredos. Se precisar encerrar com trabalho incompleto, deixe-o consistente, marque o commit como WIP, atualize `HANDOFF.md` e faça push apenas para a branch do WP. Nunca envie WIP para a branch principal nem para produção. Faça merge somente com o gate aprovado e publique produção apenas pela branch principal protegida ou por versão marcada.
