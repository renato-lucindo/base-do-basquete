# Backup, restauração e reconstrução

## Escopo real

O PostgreSQL contém dados, Auth, RLS, funções e auditoria. Objetos do Storage não fazem parte do backup do banco e precisam de cópia separada; os metadados do Storage sozinhos não restauram os PDFs. No plano Free, não dependa de backups diários da plataforma: mantenha exportações lógicas regulares, criptografadas e fora do repositório. Qualquer mudança de plano, custo ou restauração destrutiva em produção requer ação humana.

## Backup

1. Confirme o ambiente e registre horário e versão da aplicação. Nunca exponha a connection string na linha de comando, log ou documentação.
2. Execute `supabase db dump` por canal seguro para obter roles, schema e dados conforme a documentação atual; confira explicitamente a cobertura dos schemas gerenciados de Auth e Storage.
3. Exporte os objetos do bucket privado `boxscore-pdfs` com checksum e manifesto de caminho/tamanho. Não torne o bucket público.
4. Criptografe os artefatos antes de enviá-los ao armazenamento externo e registre somente local, data, checksum do arquivo criptografado e política de retenção.
5. Teste leitura, descriptografia e checksum sem restaurar sobre o ambiente de origem.

## Restauração em staging

1. Crie ou selecione um projeto de staging vazio e isolado. Confirme duas vezes que não é produção.
2. Aplique migrations em ordem e restaure roles/schema/dados pela ferramenta oficial. Depois restaure os objetos privados do Storage e compare o manifesto.
3. Execute os testes SQL/RLS, `npm run check`, `/health`, smoke público, login com MFA `aal2`, leitura de PDF privado e reconciliação de contagens/auditoria.
4. Registre duração, divergências e checksums. Descarte o staging somente após preservar a evidência; apagar o projeto requer confirmação humana.

## Reconstrução testada continuamente

O job `database` da CI inicia um PostgreSQL/Supabase efêmero, aplica todas as migrations e seed do zero e executa pgTAP. Isso comprova reconstrução de schema, funções e RLS, mas não substitui o ensaio periódico de restauração de dados e objetos do Storage.

Referências oficiais: [Supabase database backups](https://supabase.com/docs/guides/platform/backups) e [Supabase CLI db dump](https://supabase.com/docs/reference/cli/supabase-db-dump).
