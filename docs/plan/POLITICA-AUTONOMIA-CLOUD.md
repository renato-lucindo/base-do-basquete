# Política de autonomia e operação cloud-first

## Fonte da verdade

| Conteúdo | Destino autoritativo |
| --- | --- |
| Código, migrations e documentação | GitHub |
| CI, evidências e artefatos de build | GitHub Actions |
| Aplicação e previews | Cloudflare Workers |
| Banco, Auth e Storage | Supabase |
| Segredos de CI | GitHub Environments/Secrets |
| Segredos de runtime | Cloudflare Secrets |
| Credenciais gerenciadas do banco | Supabase |

Nenhum arquivo local, banco local ou configuração manual não documentada pode ser requisito para operar o produto.

## Padrões que dispensam consulta

- Repositório privado.
- Estratégia trunk-based com branch curta e PR por pacote.
- Nomes derivados de `base-do-basquete`, com sufixos `preview`, `staging` e `prod` quando necessários.
- Nenhum domínio próprio está definido. Usar URLs temporárias da plataforma e aguardar decisão posterior antes de pesquisar, registrar, comprar ou configurar domínio.
- Menor plano gratuito suficiente; nunca aderir automaticamente a plano pago.
- Versões estáveis atuais, fixadas no lockfile.
- Monólito modular antes de microserviços.
- Backend for Frontend antes de acesso direto do navegador a provedores.
- RLS e negação por padrão desde a criação das tabelas.
- Preview antes de produção.
- Mudanças aditivas e reversíveis antes de mudanças destrutivas.

## Uso autorizado do navegador

Quando API, CLI ou conector não forem suficientes, a IDE pode usar o navegador autenticado do usuário para operar:

- GitHub;
- Cloudflare;
- Supabase.

Esse uso inclui criar projetos, configurar integrações, cadastrar variáveis sem revelar seus valores, observar builds e logs e concluir configurações de deploy.

A IDE não deve pedir autorização novamente para cada ação reversível dentro desses três ambientes. Confirmações obrigatórias da plataforma, MFA, CAPTCHA, pagamento e ações destrutivas continuam sendo tratadas como bloqueios humanos pontuais.

## Política de decisões

- Decisão reversível: decidir, documentar e executar.
- Incerteza técnica: consultar documentação oficial, criar spike curto e escolher pela evidência.
- Falha automática: corrigir e tentar novamente até três vezes.
- Falha persistente: registrar diagnóstico e pedir somente o desbloqueio necessário.
- Requisito opcional: entregar o caminho mais simples e registrar evolução futura.

## Gate consolidado

Ao final de cada pacote, executar na CI:

- instalação reproduzível pelo lockfile;
- lint e formatação;
- TypeScript strict;
- testes unitários e de integração afetados;
- testes SQL/RLS quando houver banco;
- build do Worker;
- varredura de segredos e dependências;
- preview e smoke test quando o pacote for publicável.

Uma única evidência do gate substitui múltiplas solicitações de validação manual.
