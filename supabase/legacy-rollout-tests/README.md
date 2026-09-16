# Fixtures históricas do rollout de classificação

Estas quatro suítes registram o comportamento transitório anterior ao POST-04,
quando competições e perfis privados ainda podiam permanecer com valor nulo ou
marcados para revisão. Elas são preservadas como evidência, mas não integram o
gate pós-enforcement porque tentam construir estados que o schema final recusa
antes da execução das RPCs.

A cobertura vigente está distribuída entre:

- `post04_final_profile_enforcement.test.sql`, para invariantes finais, criação
  atômica, relatório zerado e privacidade;
- `admin_roster_transactions.test.sql`, para mutações autoritativas de elenco;
- `fiba_boxscore_import.test.sql` e `wp14_boxscore_enhancements.test.sql`, para
  importações completas no único formato suportado;
- os testes de autorização AAL2 e RLS mantidos no diretório `database/`.

Os arquivos históricos não devem ser reativados sem primeiro reescrever suas
fixtures para estados válidos no contrato final.
