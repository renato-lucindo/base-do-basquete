# MVP-05 — QA, release candidata e handoff

Estado: DOING na branch `feature/admin-workflow-improvements`, PR draft #35.

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

## Próximo gate

Executar o gate completo e o novo smoke no preview pelo CI, atualizar a descrição da PR e retirar o estado draft somente com todos os checks verdes. A candidata Cloudflare `upload-candidate` só pode ser criada depois da integração pela `main`; nenhum WIP será enviado à produção.
