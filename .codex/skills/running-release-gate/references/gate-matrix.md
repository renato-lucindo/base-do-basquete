# Gate matrix

Use the narrowest row that covers the actual delta. The current repository definitions remain authoritative.

| Change | Required gate additions |
| --- | --- |
| Documentation only, no governance change | formatting/lint or documented normal gate; justify specialist-review waiver |
| Agent governance, workflow, dependency, configuration | consolidated `npm run check`, relevant static validation, QA reviewer, CI and CodeQL |
| Functional server/domain code | consolidated gate, affected tests, preview and relevant smoke |
| Database/Auth/Storage/private data | database from zero, complete pgTAP, database-security opinion, advisors/reconciliation when remote state changes |
| Boxscore ingestion | supported fixtures, focal Vitest, relevant pgTAP/concurrency, boxscore-domain opinion |
| Statistics | focal domain/UI tests, public SQL tests, statistics-domain opinion, benchmark when query shape or scale changes |
| Material UI | focal tests, accessibility review, affected mobile/desktop browser evidence |
| Performance fix | repeatable baseline/candidate comparison and performance investigator report |
| Production release | exact main commit, release runbook, rollback, deploy identity, all required smokes and applicable benchmark |

The default consolidated gate is the current `npm run check`. Do not repeat it after documentation-only evidence recording when the reviewed artifact is unchanged.
