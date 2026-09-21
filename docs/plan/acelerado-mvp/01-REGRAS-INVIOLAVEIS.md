# Regras invioláveis

1. O frontend é não confiável. Autenticação, autorização, validações, cálculos, transições e gravações pertencem ao backend e ao PostgreSQL.
2. Toda escrita administrativa exige a conta singleton e AAL2. Escritas críticas são transacionais, idempotentes e auditadas.
3. Tabelas expostas nascem com RLS e grants mínimos. `anon`, usuário autenticado não administrador e AAL1 são testados.
4. Secrets, tokens, cookies, service role, connection strings, caminhos internos e credenciais nunca entram em código, logs, documentação ou resposta.
5. PDFs ficam privados. O importador aceita somente os contratos versionados FIBA/Genius Sports e Basketball Site e usa os três PDFs documentados como fixtures dos respectivos parsers. OCR e parser genérico continuam proibidos.
6. Não inferir naipe, sexo, fase, confronto, classificação ou autoridade por nome, número do jogo ou presença de dados.
7. Não remover colunas legadas durante este plano. Mudanças de schema são aditivas; migrations enviadas ou aplicadas não são reescritas.
8. Não apagar ou reclassificar histórico para satisfazer gate. Pendências ficam explícitas.
9. WIP só pode ir para a branch da PR #35. Merge e produção exigem pacote estável, gate aprovado e caminho autorizado por `main` ou versão.
10. Nenhuma otimização de prazo autoriza reduzir MFA, RLS, integridade referencial, validação server-side, testes de negação ou varredura de segredos.

## Limites do trabalho autônomo

Prosseguir sem validação intermediária em decisões técnicas reversíveis. Interromper apenas por login, MFA, CAPTCHA, pagamento, domínio, consentimento indelegável ou ação destrutiva em produção.
