# Acessibilidade

## Baseline obrigatória

Toda alteração de interface deve preservar HTML semântico, operação por teclado, foco visível, labels e erros associados aos campos, alternativas textuais, contraste legível, informação independente de cor, responsividade, zoom de 200% e redução de movimento. As regras normativas resumidas estão em `AGENTS.md`.

## Sienna

O projeto usa `sienna-accessibility` `2.2.333` como recurso complementar de personalização. O componente `app/components/sienna-accessibility.tsx` carrega o widget apenas no navegador, uma única vez, em português e na lateral direita. Falhas do widget não impedem o funcionamento da aplicação.

O script `scripts/prepare-sienna.mjs` copia o bundle, as traduções e as fontes da dependência fixada para `public/vendor/sienna/` antes de desenvolvimento e build. As referências do fornecedor ao CDN são substituídas por caminhos do próprio site, e o fallback de preferências em cookie é removido; assim, a CSP não recebe novas origens e as preferências permanecem no armazenamento local do navegador. O diretório gerado não é versionado.

Para atualizar o Sienna:

1. altere a versão exata em `package.json` e no lockfile;
2. atualize `EXPECTED_VERSION` em `scripts/prepare-sienna.mjs`;
3. revise licença, código distribuído, URLs externas, persistência e comportamento de teclado;
4. execute os testes focais, o build e o gate completo.

O Sienna não certifica conformidade e não substitui correções no código da aplicação.
