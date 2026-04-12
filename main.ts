import { Plugin, TAbstractFile, TFile } from "obsidian";
import {
	ContentMentionSettingTab,
	DEFAULT_SETTINGS,
	isMarkdownFile,
	sanitizeSettings,
	type ContentMentionSettings,
} from "./src/settings";
import { ContentIndex } from "./src/search/contentIndex";
import { ContentMentionSuggest } from "./src/suggest/contentMentionSuggest";

export default class ContentMentionPlugin extends Plugin {
	settings: ContentMentionSettings = DEFAULT_SETTINGS;
	private contentIndex!: ContentIndex;

	async onload(): Promise<void> {
		this.settings = sanitizeSettings({
			...DEFAULT_SETTINGS,
			...(await this.loadData()),
		});

		this.contentIndex = new ContentIndex(this.app, () => this.settings);
		await this.contentIndex.initialize();

		this.registerEditorSuggest(
			new ContentMentionSuggest(this.app, () => this.settings, this.contentIndex),
		);
		this.addSettingTab(new ContentMentionSettingTab(this.app, this));
		this.registerVaultEvents();
	}

	onunload(): void {
		this.contentIndex?.destroy();
	}

	async saveSettings(): Promise<void> {
		this.settings = sanitizeSettings(this.settings);
		await this.saveData(this.settings);
	}

	async rebuildIndex(): Promise<void> {
		await this.contentIndex.rebuild();
	}

	private registerVaultEvents(): void {
		this.registerEvent(
			this.app.vault.on("create", (file: TAbstractFile) => {
				if (isMarkdownFile(file)) {
					this.contentIndex.scheduleUpdate(file);
				}
			}),
		);

		this.registerEvent(
			this.app.vault.on("modify", (file: TAbstractFile) => {
				if (isMarkdownFile(file)) {
					this.contentIndex.scheduleUpdate(file);
				}
			}),
		);

		this.registerEvent(
			this.app.vault.on("delete", (file: TAbstractFile) => {
				if (isMarkdownFile(file)) {
					this.contentIndex.removeFile(file.path);
				}
			}),
		);

		this.registerEvent(
			this.app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
				this.contentIndex.removeFile(oldPath);
				if (file instanceof TFile) {
					this.contentIndex.scheduleUpdate(file);
				}
			}),
		);
	}
}
