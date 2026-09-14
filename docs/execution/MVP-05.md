# MVP-05 — QA, release candidata e handoff

Estado: DONE em produção. A entrega principal entrou pela PR #35; as correções de release entraram pelas PRs #39 e #40.

## Gate já concluído

- MVP-04 fechado: agenda, progressão e publicação versionada aplicadas; 37/37 pgTAP persistentes, advisors e hashes esportivos aprovados.
- CI do head documental `4c29b1b`: `gate`, `database`, `upload` e `analyze` aprovados. O job de banco reconstrói todas as migrations e o seed do zero antes do pgTAP.
- Preview público: classificação FIBA renderiza 93 × 39 e 67 × 58; a fixture 100 não entra na busca nem em contexto público.
- Preview AAL2: sessão confirmada; edições legadas exibem versão atual 1; fixture 100 exibe “Ainda não publicada”, cinco posições pendentes e ação desabilitada. Nenhuma mutação foi executada.
- Responsividade: 390, 768 e 1440 px sem overflow global. Foco por teclado exibiu outline sólido de 3 px. O reflow equivalente ao zoom 200% foi verificado em 720 CSS px sobre viewport física de 1440 px, sem overflow; o navegador embutido não expôs controle de zoom real.
- Negação AAL1 e anon para revisão/publicação está no pgTAP focal. As RPCs administrativas usam o mesmo singleton AAL2; usuário autenticado fora do singleton é negado por `is_current_admin_aal2` nas suítes de autorização desde zero.
- Gate local após tipos integrais: 38 arquivos/262 Vitest, lint, TypeScript estrito, build, cinco runbooks e varredura de 529 arquivos.

## Smoke automatizado de release

`scripts/smoke-mvp-release.mjs` recusa host inesperado e valida preview ou produção por ambiente explícito. Ele cobre health, headers, entrada administrativa sem sessão, classificação publicada, marcadores privados ausentes e busca global sem a fixture draft. O workflow de preview e o deploy de produção passam a executá-lo obrigatoriamente.

## Fluxos P0 rastreados

- Criação privada por preset, atribuição, agenda e progressão: pgTAP de MVP-03/MVP-04 e prova concorrente em banco descartável.
- Súmula manual sobre jogo existente: testes de domínio/rota e pgTAP transacional de súmula.
- FIBA/Genius Sports sobre jogo existente: os dois PDFs fixture, parser, revisão de nomes semelhantes, confirmação transacional e regressões públicas.
- Publicação e leitura anônima: snapshot imutável, RLS, fingerprints, smoke HTTP e QA AAL2/anon.

## Pendências pós-MVP preservadas

- `POST-01`: fallback manual, suplemento, conflitos por domínio e projeção rara.
- `POST-02`: retirada/clonagem e editor estrutural completo.
- `POST-03`: fechamento de grupos, W.O. e emendas.
- `POST-04`: enforcement final depois de zerar filas humanas e fechamento integral de `09A–09C`.

Esses itens não bloqueiam a candidata porque possuem estado explícito de indisponibilidade/revisão; nenhum fallback implícito ou dado inventado foi introduzido.

## Release concluída

O commit `b16a1e5` passou os quatro checks; a PR #35 recebeu descrição consolidada, saiu de draft e foi integrada por squash em `37bf85c`. A `main` repetiu gate/banco desde zero no workflow `34841934565` e CodeQL no `34841934543`.

A candidata `release-37bf85c6dea0`, versão Cloudflare `cc9cece2-e4e9-49c2-a444-c04cfb154ca0`, foi carregada sem tráfego pelo workflow `34842422384`. O primeiro deploy da `main` criou a versão `68445c64-df5c-42ff-870e-08c0fc0f432d`; health passou, mas a navegação executada imediatamente depois recebeu por propagação a rota raiz da versão anterior. A repetição após a propagação aprovou navegação e `smoke:mvp`, confirmando produção saudável.

A PR #39 integrou em `92ff57f` o retry limitado da resolução raiz durante a propagação do Worker. A primeira repetição do deploy publicou corretamente a aplicação e aprovou os três smokes, mas revelou que o benchmark ainda usava a rota legada do jogo. A PR #40 trocou somente esse alvo pela URL canônica com naipe e entrou na `main` em `f8dcb87` após `gate`, `database`, `upload` e `analyze` verdes.

O workflow protegido `34845342461` publicou a `main` com sucesso integral em 14/09/2026. A versão imutável Cloudflare é `f3505b09-a831-4e0a-a2a7-5f0960b17d7b`; a tag Git `v1.1.0` aponta exatamente para `f8dcb87`. Health, cabeçalhos, entrada administrativa anônima, contexto público, privacidade do MVP e limpeza do arquivo efêmero passaram no próprio workflow.

O benchmark automatizado de dez amostras registrou estatísticas p50 471,2 ms/p95 646,0 ms e jogo FIBA p50 1.420,3 ms/p95 1.664,4 ms. Uma medição manual anterior de dez amostras ficou em p95 606,6/789,3 ms; a confirmação de trinta amostras registrou p95 285,1/2.684,1 ms. A cauda do detalhe do jogo deve, portanto, ser reavaliada no pós-MVP conforme ADR 0003; ela não afetou saúde, correção, privacidade ou disponibilidade da release.

Próximo pacote funcional: `POST-01`. Manter também medição repetida do detalhe do jogo em janelas distintas e avaliar o adaptador read-through público previsto na ADR 0003 somente se o p95 acima de 1.500 ms permanecer sustentado.
