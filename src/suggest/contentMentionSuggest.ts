import {
	App,
	Editor,
	EditorSuggestContext,
	EditorPosition,
	EditorSuggest,
	EditorSuggestTriggerInfo,
	TFile,
} from "obsidian";
import { type ContentMentionSettings } from "../settings";
import { ContentIndex, type SearchResult } from "../search/contentIndex";

const QUERY_BREAK_REGEX = /[\s\p{P}\p{S}]/u;

interface MentionTriggerInfo extends EditorSuggestTriggerInfo {
	start: EditorPosition;
	end: EditorPosition;
}

export class ContentMentionSuggest extends EditorSuggest<SearchResult> {
	private getSettings: () => ContentMentionSettings;
	private index: ContentIndex;
	private latestContext: EditorSuggestContext | null = null;
	private searchTimer: number | null = null;
	private pendingResolve: ((value: SearchResult[]) => void) | null = null;

	constructor(
		app: App,
		getSettings: () => ContentMentionSettings,
		index: ContentIndex,
	) {
		super(app);
		this.getSettings = getSettings;
		this.index = index;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null,
	): MentionTriggerInfo | null {
		const triggerCharacter = this.getSettings().triggerCharacter;
		const line = editor.getLine(cursor.line);
		const mention = this.readMention(line, cursor.ch, triggerCharacter);
		if (!mention || mention.query.length === 0) {
			this.latestContext = null;
			return null;
		}

		const context: MentionTriggerInfo = {
			start: {
				line: cursor.line,
				ch: mention.triggerPosition,
			},
			end: cursor,
			query: mention.query,
		};
		return context;
	}

	getSuggestions(context: EditorSuggestContext): Promise<SearchResult[]> {
		this.latestContext = context;
		return new Promise((resolve) => {
			if (this.pendingResolve) {
				this.pendingResolve([]);
			}
			if (this.searchTimer !== null) {
				window.clearTimeout(this.searchTimer);
			}

			this.pendingResolve = resolve;
			this.searchTimer = window.setTimeout(() => {
				this.pendingResolve = null;
				this.searchTimer = null;
				resolve(this.index.search(context.query));
			}, 100);
		});
	}

	renderSuggestion(result: SearchResult, el: HTMLElement): void {
		el.empty();

		const titleEl = el.createDiv({ cls: "suggestion-title" });
		this.appendHighlightedText(
			titleEl,
			result.basename,
			result.basenameMatchIndex >= 0 ? result.basenameMatchIndex : null,
			this.latestContext?.query.length ?? 0,
		);

		el.createDiv({
			cls: "suggestion-note",
			text: result.path,
		});

		if (result.preview.length > 0) {
			const previewEl = el.createDiv({ cls: "suggestion-note" });
			this.appendHighlightedText(
				previewEl,
				result.preview,
				result.previewMatchIndex,
				result.previewMatchLength,
			);
		}
	}

	selectSuggestion(result: SearchResult): void {
		if (!this.context || !this.latestContext) {
			return;
		}

		const target = this.shouldInsertRawQuery(result.basename)
			? this.latestContext.query
			: result.basename;
		const link = `[[${target}]]`;
		this.context.editor.replaceRange(
			link,
			this.latestContext.start,
			this.latestContext.end,
		);
		this.close();
	}

	close(): void {
		if (this.searchTimer !== null) {
			window.clearTimeout(this.searchTimer);
			this.searchTimer = null;
		}
		if (this.pendingResolve) {
			this.pendingResolve([]);
			this.pendingResolve = null;
		}
		super.close();
	}

	private readMention(
		line: string,
		cursorCh: number,
		triggerCharacter: string,
	): { query: string; triggerPosition: number } | null {
		let queryStart = cursorCh;
		while (queryStart > 0 && this.isQueryCharacter(line[queryStart - 1], triggerCharacter)) {
			queryStart -= 1;
		}

		const triggerPosition = queryStart - 1;
		if (triggerPosition < 0 || line[triggerPosition] !== triggerCharacter) {
			return null;
		}

		const previousCharacter =
			triggerPosition > 0 ? line[triggerPosition - 1] : null;
		if (
			previousCharacter &&
			this.isQueryCharacter(previousCharacter, triggerCharacter)
		) {
			return null;
		}

		return {
			query: line.slice(queryStart, cursorCh),
			triggerPosition,
		};
	}

	private isQueryCharacter(
		character: string | null | undefined,
		triggerCharacter: string,
	): boolean {
		if (!character || character === triggerCharacter) {
			return false;
		}

		return !QUERY_BREAK_REGEX.test(character);
	}

	private shouldInsertRawQuery(basename: string): boolean {
		return this.getSettings().untitledLikePatterns.some((pattern) => {
			try {
				return new RegExp(pattern, "i").test(basename);
			} catch {
				return false;
			}
		});
	}

	private appendHighlightedText(
		container: HTMLElement,
		text: string,
		matchIndex: number | null,
		matchLength: number,
	): void {
		if (
			matchIndex === null ||
			matchIndex < 0 ||
			matchLength <= 0 ||
			matchIndex + matchLength > text.length
		) {
			container.setText(text);
			return;
		}

		container.appendText(text.slice(0, matchIndex));
		container.createEl("mark", {
			text: text.slice(matchIndex, matchIndex + matchLength),
		});
		container.appendText(text.slice(matchIndex + matchLength));
	}
}
