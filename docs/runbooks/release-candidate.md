# Release candidata do MVP

## Regra de entrada

Uma candidata só pode ser criada depois que o pacote deixou de ser WIP, a PR passou `gate`, `database`, `upload` e `analyze`, e o commit foi integrado pela `main` protegida. Branch de trabalho nunca envia versão ao Worker de produção. A release usa apenas a URL temporária `workers.dev`; domínio próprio continua fora do escopo.

Antes da integração, confirme no preview:

1. `npm run check` e `npm run smoke:mvp -- <PREVIEW_URL> preview` aprovados;
2. migrations desde zero e pgTAP aprovados na CI;
3. migrations compartilhadas, contagens, checksums e advisors reconciliados;
4. QA anônimo e sessão administrativa MFA em `aal2` aprovados;
5. nenhuma credencial, PDF privado, perfil privado ou edição não publicada no tráfego público.

## Criar sem ativar tráfego

Na `main` verde, execute o workflow **Bootstrap Worker deploy** com `environment=production` e `release_mode=upload-candidate`. O job gera a tag Cloudflare `release-<sha-curto>`, compila com `APP_ENV=production`, verifica o nome `base-do-basquete-prod` e carrega code e secrets atomicamente. A candidata não recebe tráfego apenas por ser enviada.

Registre no HANDOFF somente SHA, tag, ID da versão e URL pública temporária. Nunca copie valores de secrets, tokens, cookies, connection strings ou conteúdo do arquivo efêmero do runner.

## Promover e validar

Promova somente a candidata associada ao SHA integrado e depois de confirmar compatibilidade com as migrations aplicadas. O deploy de produção deve partir da `main` ou de versão marcada e executar automaticamente:

- health e headers de segurança;
- navegação pública contextual;
- `npm run smoke:mvp -- <PRODUCTION_URL> production`;
- benchmark público controlado;
- limpeza do arquivo efêmero de secrets.

Em seguida, valide leitura pública, login/MFA `aal2`, auditoria e observabilidade sem payload sensível. Se algum gate falhar, não faça nova publicação às cegas: mantenha ou restaure a versão saudável.

## Rollback

O rollback do Worker não desfaz migrations, Storage ou dados. Antes de `wrangler rollback --env production`, confirme que a versão anterior é compatível com o schema atual. Se não for, publique uma correção aditiva pela mesma trilha. O procedimento detalhado permanece em `docs/runbooks/rollback.md`.
