# Manual test plan

1. Body-only match: create a note whose filename does not contain `codexMCP`, add `codexMCP` in the body, type `@codexMCP`, and confirm the note appears.
2. Filename match: create a note named `codexMCP.md`, type `@codex`, and confirm the filename match appears near the top.
3. Untitled special case: create `Untitled.md` with matching body text, select it from `@codexMCP`, and confirm the editor inserts `[[codexMCP]]`.
4. Chinese phrase match: add a Chinese phrase like `内容提及测试` to a note body, type `@内容提及`, and confirm the note appears.
5. Excluded folder behavior: add a matching note under an excluded folder and confirm it no longer appears after updating plugin settings.
6. Cache refresh: rename or modify a matching note, then type the same query again and confirm the result list reflects the new filename or content.
7. Multiple matches ranking sanity: create several matches across basename and body, then confirm basename matches rank above body-only matches and shorter paths win ties.
