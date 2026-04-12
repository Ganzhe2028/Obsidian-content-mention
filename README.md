# content-mention

`content-mention` adds a content-first `@mention` flow to the Obsidian editor.

## What it does

- Starts inline suggestions when you type `@` and at least one more character.
- Searches Markdown note bodies first, while also considering basename matches.
- Shows up to 10 results with basename, relative path, and a matched line preview.
- Inserts `[[basename]]` on selection, or `[[rawQuery]]` when the target basename looks untitled.

## Settings

- Trigger character
- Max results
- Untitled-like regex patterns
- Include folders
- Exclude folders
- Case sensitive search

## Development

```bash
npm install
npm run dev
```

## Tradeoffs

- v1 keeps a lightweight in-memory cache of Markdown file lines and updates it on vault changes instead of building a persistent index.
- Ranking is intentionally simple and readable: basename matches outrank body-only matches, body hits at line start score higher, then shorter paths and newer files break ties.
- Link insertion uses `[[basename]]` by design, so duplicate basenames still rely on Obsidian's normal wikilink resolution behavior.

## Possible v2 ideas

- Block-level insertion like `[[file#heading]]` or `[[file#^blockid]]`
- Smarter tokenization for camelCase, kebab-case, and mixed Chinese-English text
- Richer result preview highlighting
- Modifier key to open the result instead of inserting a link
- Recent selection boosting
