# content-mention

[中文说明](./README.zh-CN.md) | [MIT License](./LICENSE) | [Manual Test Plan](./MANUAL-TEST-PLAN.md)

`content-mention` is an Obsidian community plugin for content-first `@mentions`.

When you remember a phrase from an old note body but not the note title, type `@phrase` while writing. The plugin searches Markdown file content, ranks likely matches, and inserts a wikilink back into the editor.

## What It Does

- Starts inline suggestions in the Markdown editor after you type the trigger character and at least one more character
- Searches note body content first, while still considering basename matches
- Uses case-insensitive substring matching by default, which works well for English and Chinese in v1
- Shows up to 10 results with basename, relative path, and a matched line preview
- Inserts `[[basename]]` on selection, or `[[rawQuery]]` when the matched note looks untitled
- Keeps a lightweight in-memory cache and refreshes it on create, modify, delete, and rename events

## Ranking in v1

- Exact basename match ranks highest
- Basename prefix and basename substring matches rank above body-only matches
- Body matches near the start of a line rank higher
- Shorter paths are slightly preferred
- Newer file modification times are used as a weak tie-breaker

## Quick Start

### For People Who Just Want to Use the Plugin

#### Install from a release package

1. Download the latest release package.
2. Create this folder inside your vault:

   ```text
   <your-vault>/.obsidian/plugins/content-mention/
   ```

3. Put these three files into that folder:

   ```text
   main.js
   manifest.json
   versions.json
   ```

4. Open Obsidian, go to `Settings -> Community plugins`, refresh the plugin list if needed, and enable `content-mention`.
5. Open the plugin settings and adjust the trigger character, result count, or folder filters if needed.

#### Install from a cloned repository

1. Clone this repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the plugin:

   ```bash
   npm run build
   ```

4. Copy `main.js`, `manifest.json`, and `versions.json` into:

   ```text
   <your-vault>/.obsidian/plugins/content-mention/
   ```

5. Enable `content-mention` in Obsidian community plugins.

### For Human Developers

This path is for someone who wants to edit the plugin and run it in a local vault.

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Start the watcher:

   ```bash
   npm run dev
   ```

3. Create a test vault plugin folder:

   ```text
   <your-test-vault>/.obsidian/plugins/content-mention/
   ```

4. Copy these files from the repository into that folder after the first build:

   ```text
   main.js
   manifest.json
   versions.json
   ```

5. Reload Obsidian and enable the plugin.
6. Edit source files under `main.ts` and `src/`.
7. Re-copy the built `main.js` into the vault plugin folder when you want Obsidian to use the latest build.

Source layout:

- `main.ts`: plugin entry point and lifecycle
- `src/suggest/contentMentionSuggest.ts`: inline `EditorSuggest` behavior
- `src/search/contentIndex.ts`: in-memory content cache and ranking
- `src/settings.ts`: settings model and settings tab

### For AI Coding Agents

If you are using an AI coding workflow, use this repository like this:

1. Install dependencies with `npm install`.
2. Make source changes in `main.ts` and `src/`. Do not edit `main.js` directly.
3. Run `npm run build` for a production bundle or `npm run dev` for watch mode.
4. Treat these as the release artifacts:

   ```text
   main.js
   manifest.json
   versions.json
   ```

5. Copy the release artifacts into the target vault plugin folder before manual testing.
6. Update both `README.md` and `README.zh-CN.md` when the user-facing behavior changes.

## Settings

- `Trigger character`: default is `@`
- `Max results`: default is `10`
- `Untitled-like regex patterns`: editable list, case-insensitive
- `Include folders`: empty means the whole vault
- `Exclude folders`: always wins over include folders
- `Case sensitive search`: off by default

## Tradeoffs in v1

- The plugin keeps a lightweight in-memory cache instead of a persistent index. This keeps the code small and avoids rescanning the whole vault on every keystroke.
- Ranking is intentionally simple and inspectable. It favors useful filename matches without dropping body-only search, which is the core job of the plugin.
- Inserted links use `[[basename]]` by default, so duplicate basenames still follow Obsidian's normal wikilink resolution behavior.

## Manual Testing

Use the checklist in [MANUAL-TEST-PLAN.md](./MANUAL-TEST-PLAN.md).

## Future v2 Ideas

- Block-level insertion like `[[file#heading]]` or `[[file#^blockid]]`
- Smarter tokenization for camelCase, kebab-case, and mixed Chinese-English text
- Richer result preview highlighting
- A modifier key to open the result instead of inserting a link
- Recent selection boosting
