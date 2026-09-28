# Contract, fixture, and test matrix

Discover current files before execution; this matrix identifies the authoritative areas.

| Concern | Sources and fixtures | Focal evidence |
| --- | --- | --- |
| FIBA/Genius extraction and geometry | `docs/plan/MODELO-BOXSCORE-FIBA.md`; FIBA PDFs under `docs/plan/referencias/modelos-boxscore/` | `app/modules/boxscore/extract.server.test.ts`, `app/modules/boxscore/parser.test.ts` |
| Basketball Site parsing | `docs/plan/MODELO-BOXSCORE-SITE.md`; `Boxscore-site.pdf` | parser/extraction tests and `supabase/tests/database/basketball_site_boxscore.test.sql` |
| Player matching | model contracts and roster state | `app/modules/boxscore/matching.test.ts` |
| Administrative review | import route and review editor | `app/routes/admin.competitions.$competitionId.boxscores.import.test.ts` |
| FIBA persistence | migrations/RPCs and private storage contract | `supabase/tests/database/fiba_boxscore_import.test.sql` |
| Team resolution | explicit review and authoritative resolution | `supabase/tests/database/boxscore_team_resolution.test.sql`, `scripts/test-boxscore-team-resolution-concurrency.mjs` |
| Extended historical behavior | WP-14 and eligibility contracts | `supabase/tests/database/wp14_boxscore_enhancements.test.sql` and affected eligibility tests |

For parser changes, run every supported PDF fixture. For persistence-only changes, still prove that the parsed contract reaching the database is unchanged or deliberately versioned.
