import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
	normalizePath,
} from "obsidian";

export interface ContentMentionSettings {
	triggerCharacter: string;
	maxResults: number;
	untitledLikePatterns: string[];
	includeFolders: string[];
	excludeFolders: string[];
	caseSensitive: boolean;
}

export interface ContentMentionPluginHandle extends Plugin {
	settings: ContentMentionSettings;
	saveSettings: () => Promise<void>;
	rebuildIndex: () => Promise<void>;
}

export const DEFAULT_SETTINGS: ContentMentionSettings = {
	triggerCharacter: "@",
	maxResults: 10,
	untitledLikePatterns: ["^untitled(?:\\s+\\d+)?$", "^无标题$", "^未命名$"],
	includeFolders: [],
	excludeFolders: [],
	caseSensitive: false,
};

export function sanitizeSettings(
	source: Partial<ContentMentionSettings>,
): ContentMentionSettings {
	return {
		triggerCharacter: sanitizeTriggerCharacter(source.triggerCharacter),
		maxResults: sanitizeMaxResults(source.maxResults),
		untitledLikePatterns: sanitizeStringList(
			source.untitledLikePatterns,
			DEFAULT_SETTINGS.untitledLikePatterns,
		),
		includeFolders: sanitizeFolderList(source.includeFolders),
		excludeFolders: sanitizeFolderList(source.excludeFolders),
		caseSensitive: source.caseSensitive ?? DEFAULT_SETTINGS.caseSensitive,
	};
}

export function sanitizeTriggerCharacter(value: string | undefined): string {
	return value?.trim().charAt(0) || DEFAULT_SETTINGS.triggerCharacter;
}

export function sanitizeMaxResults(value: number | string | undefined): number {
	const parsed =
		typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
	if (!Number.isFinite(parsed)) {
		return DEFAULT_SETTINGS.maxResults;
	}

	return Math.max(1, Math.min(50, parsed));
}

export function sanitizeStringList(
	value: string[] | undefined,
	fallback: string[] = [],
): string[] {
	if (value === undefined) {
		return [...fallback];
	}

	const items = (value ?? fallback)
		.map((item) => item.trim())
		.filter((item) => item.length > 0);

	return items;
}

export function parseMultilineList(value: string): string[] {
	return value
		.split(/\r?\n/)
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

export function sanitizeFolderList(value: string[] | undefined): string[] {
	return (value ?? [])
		.map((item) => item.trim().replace(/^\/+|\/+$/g, ""))
		.filter((item) => item.length > 0)
		.map((item) => normalizePath(item));
}

export function isMarkdownFile(file: TAbstractFile): file is TFile {
	return file instanceof TFile && file.extension.toLowerCase() === "md";
}

export function isPathAllowed(
	path: string,
	includeFolders: string[],
	excludeFolders: string[],
): boolean {
	const normalizedPath = normalizePath(path);
	const included =
		includeFolders.length === 0 ||
		includeFolders.some((folder) => {
			return normalizedPath === folder || normalizedPath.startsWith(`${folder}/`);
		});
	const excluded = excludeFolders.some((folder) => {
		return normalizedPath === folder || normalizedPath.startsWith(`${folder}/`);
	});

	return included && !excluded;
}

export class ContentMentionSettingTab extends PluginSettingTab {
	private plugin: ContentMentionPluginHandle;

	constructor(app: App, plugin: ContentMentionPluginHandle) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Trigger character")
			.setDesc("Single character that starts content mentions.")
			.addText((text) => {
				text
					.setPlaceholder("@")
					.setValue(this.plugin.settings.triggerCharacter)
					.onChange(async (value) => {
						this.plugin.settings.triggerCharacter = sanitizeTriggerCharacter(value);
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName("Max results")
			.setDesc("Maximum number of suggestions shown at once.")
			.addText((text) => {
				text.inputEl.type = "number";
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.maxResults))
					.setValue(String(this.plugin.settings.maxResults))
					.onChange(async (value) => {
						this.plugin.settings.maxResults = sanitizeMaxResults(value);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Untitled-like regex patterns")
			.setDesc("One regex per line. Matching basenames insert [[rawQuery]] instead.")
			.addTextArea((text) => {
				text.inputEl.rows = 4;
				text
					.setPlaceholder(DEFAULT_SETTINGS.untitledLikePatterns.join("\n"))
					.setValue(this.plugin.settings.untitledLikePatterns.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.untitledLikePatterns =
							parseMultilineList(value);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Include folders")
			.setDesc("One folder per line. Leave empty to search the whole vault.")
			.addTextArea((text) => {
				text.inputEl.rows = 4;
				text
					.setPlaceholder("Projects\nArchive/Notes")
					.setValue(this.plugin.settings.includeFolders.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.includeFolders = sanitizeFolderList(
							parseMultilineList(value),
						);
						await this.plugin.saveSettings();
						await this.plugin.rebuildIndex();
					});
			});

		new Setting(containerEl)
			.setName("Exclude folders")
			.setDesc("One folder per line. Excluded folders win over included folders.")
			.addTextArea((text) => {
				text.inputEl.rows = 4;
				text
					.setPlaceholder("Templates\nDaily")
					.setValue(this.plugin.settings.excludeFolders.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.excludeFolders = sanitizeFolderList(
							parseMultilineList(value),
						);
						await this.plugin.saveSettings();
						await this.plugin.rebuildIndex();
					});
			});

		new Setting(containerEl)
			.setName("Case sensitive search")
			.setDesc("When off, basename and body matches are case-insensitive.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.caseSensitive)
					.onChange(async (value) => {
						this.plugin.settings.caseSensitive = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
