import { App, TFile } from "obsidian";
import { isPathAllowed, type ContentMentionSettings } from "../settings";

interface CachedMarkdownFile {
	file: TFile;
	path: string;
	basename: string;
	mtime: number;
	lines: string[];
}

interface BodyMatch {
	line: string;
	matchIndex: number;
	lineNumber: number;
}

interface PreviewMatch {
	text: string;
	matchIndex: number | null;
}

export interface SearchResult {
	file: TFile;
	basename: string;
	path: string;
	preview: string;
	previewMatchIndex: number | null;
	previewMatchLength: number;
	basenameMatchIndex: number;
	score: number;
	mtime: number;
}

export class ContentIndex {
	private app: App;
	private getSettings: () => ContentMentionSettings;
	private cache = new Map<string, CachedMarkdownFile>();
	private pendingUpdates = new Map<string, TFile>();
	private updateTimer: number | null = null;

	constructor(app: App, getSettings: () => ContentMentionSettings) {
		this.app = app;
		this.getSettings = getSettings;
	}

	async initialize(): Promise<void> {
		await this.rebuild();
	}

	destroy(): void {
		if (this.updateTimer !== null) {
			window.clearTimeout(this.updateTimer);
			this.updateTimer = null;
		}
	}

	async rebuild(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles();
		const nextCache = new Map<string, CachedMarkdownFile>();

		await Promise.all(
			files.map(async (file) => {
				const entry = await this.readFile(file);
				if (entry) {
					nextCache.set(entry.path, entry);
				}
			}),
		);

		this.cache = nextCache;
	}

	scheduleUpdate(file: TFile): void {
		this.pendingUpdates.set(file.path, file);
		if (this.updateTimer !== null) {
			window.clearTimeout(this.updateTimer);
		}

		this.updateTimer = window.setTimeout(() => {
			void this.flushUpdates();
		}, 120);
	}

	removeFile(path: string): void {
		this.pendingUpdates.delete(path);
		this.cache.delete(path);
	}

	search(rawQuery: string): SearchResult[] {
		const settings = this.getSettings();
		const query = settings.caseSensitive ? rawQuery : rawQuery.toLowerCase();
		if (!query) {
			return [];
		}

		const results: SearchResult[] = [];

		for (const entry of this.cache.values()) {
			const basenameValue = settings.caseSensitive
				? entry.basename
				: entry.basename.toLowerCase();
			const basenameMatchIndex = basenameValue.indexOf(query);
			const bodyMatch = this.findBestBodyMatch(entry.lines, query, settings.caseSensitive);

			if (basenameMatchIndex === -1 && !bodyMatch) {
				continue;
			}

			const preview = bodyMatch
				? this.buildPreview(bodyMatch.line, bodyMatch.matchIndex, rawQuery.length)
				: this.buildFallbackPreview(entry.lines);

			results.push({
				file: entry.file,
				basename: entry.basename,
				path: entry.path,
				preview: preview.text,
				previewMatchIndex: bodyMatch ? preview.matchIndex : null,
				previewMatchLength: bodyMatch ? rawQuery.length : 0,
				basenameMatchIndex,
				score: this.scoreResult(entry.basename, rawQuery, basenameMatchIndex, bodyMatch),
				mtime: entry.mtime,
			});
		}

		return results
			.sort((left, right) => {
				if (left.score !== right.score) {
					return right.score - left.score;
				}
				if (left.path.length !== right.path.length) {
					return left.path.length - right.path.length;
				}
				if (left.mtime !== right.mtime) {
					return right.mtime - left.mtime;
				}
				return left.path.localeCompare(right.path);
			})
			.slice(0, settings.maxResults);
	}

	private async flushUpdates(): Promise<void> {
		const pendingFiles = [...this.pendingUpdates.values()];
		this.pendingUpdates.clear();
		this.updateTimer = null;

		await Promise.all(
			pendingFiles.map(async (file) => {
				const entry = await this.readFile(file);
				if (entry) {
					this.cache.set(entry.path, entry);
					return;
				}

				this.cache.delete(file.path);
			}),
		);
	}

	private async readFile(file: TFile): Promise<CachedMarkdownFile | null> {
		if (file.extension.toLowerCase() !== "md") {
			return null;
		}

		const settings = this.getSettings();
		if (
			!isPathAllowed(file.path, settings.includeFolders, settings.excludeFolders)
		) {
			return null;
		}

		try {
			const content = await this.app.vault.cachedRead(file);
			return {
				file,
				path: file.path,
				basename: file.basename,
				mtime: file.stat.mtime,
				lines: content.split(/\r?\n/),
			};
		} catch {
			return null;
		}
	}

	private findBestBodyMatch(
		lines: string[],
		query: string,
		caseSensitive: boolean,
	): BodyMatch | null {
		let bestMatch: BodyMatch | null = null;
		let bestScore = Number.NEGATIVE_INFINITY;

		lines.forEach((rawLine, lineNumber) => {
			const line = rawLine.trim();
			if (!line) {
				return;
			}

			const candidate = caseSensitive ? line : line.toLowerCase();
			const matchIndex = candidate.indexOf(query);
			if (matchIndex === -1) {
				return;
			}

			const score = (matchIndex === 0 ? 100 : 0) - lineNumber - matchIndex / 100;
			if (score > bestScore) {
				bestScore = score;
				bestMatch = {
					line,
					matchIndex,
					lineNumber,
				};
			}
		});

		return bestMatch;
	}

	private buildPreview(
		line: string,
		matchIndex: number,
		matchLength: number,
	): PreviewMatch {
		const maxLength = 140;
		if (line.length <= maxLength) {
			return {
				text: line,
				matchIndex,
			};
		}

		const start = Math.max(
			0,
			Math.min(matchIndex - 40, line.length - maxLength),
		);
		const end = Math.min(line.length, start + maxLength);
		const prefix = start > 0 ? "…" : "";
		const suffix = end < line.length ? "…" : "";

		return {
			text: `${prefix}${line.slice(start, end)}${suffix}`,
			matchIndex: matchIndex - start + prefix.length,
		};
	}

	private buildFallbackPreview(lines: string[]): PreviewMatch {
		const line = lines.find((item) => item.trim().length > 0)?.trim() ?? "";
		if (line.length <= 140) {
			return {
				text: line,
				matchIndex: null,
			};
		}

		return {
			text: `${line.slice(0, 139)}…`,
			matchIndex: null,
		};
	}

	private scoreResult(
		basename: string,
		rawQuery: string,
		basenameMatchIndex: number,
		bodyMatch: BodyMatch | null,
	): number {
		let score = 0;

		if (basenameMatchIndex === 0 && basename.length === rawQuery.length) {
			score += 400;
		} else if (basenameMatchIndex !== -1) {
			score += basenameMatchIndex === 0 ? 320 : 300;
		}

		if (bodyMatch) {
			score += bodyMatch.matchIndex === 0 ? 120 : 100;
			score -= Math.min(bodyMatch.lineNumber, 50);
		}

		return score;
	}
}
