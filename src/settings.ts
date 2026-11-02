import { App, PluginSettingTab, Setting } from "obsidian";
import type MotdPlugin from "./main";

export interface MotdSettings {
	art: string;
	showOnStartup: boolean;
	keepOpen: boolean;
}

// Placeholder until real art is pasted in via settings.
export const DEFAULT_ART = String.raw`
                 _      _
 _ __ ___   ___ | |_ __| |
| '_ ' _ \ / _ \| __/ _' |
| | | | | | (_) | || (_| |
|_| |_| |_|\___/ \__\__,_|
`;

export const DEFAULT_SETTINGS: MotdSettings = {
	art: DEFAULT_ART,
	showOnStartup: true,
	keepOpen: true,
};

export class MotdSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: MotdPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Show on startup")
			.setDesc("Focus the dashboard when Obsidian opens.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.showOnStartup).onChange(async (v) => {
					this.plugin.settings.showOnStartup = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Keep dashboard open")
			.setDesc("Reopen the pinned dashboard tab if it gets closed.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.keepOpen).onChange(async (v) => {
					this.plugin.settings.keepOpen = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("ASCII art")
			.setDesc("Pasted exactly as-is. Tabs become 4 spaces; leading/trailing blank lines are dropped.")
			.addExtraButton((b) =>
				b.setIcon("rotate-ccw").setTooltip("Reset to default").onClick(async () => {
					this.plugin.settings.art = DEFAULT_ART;
					await this.plugin.saveSettings();
					this.display();
				})
			);

		const area = containerEl.createEl("textarea", { cls: "motd-settings-art" });
		area.value = this.plugin.settings.art;
		area.spellcheck = false;
		area.wrap = "off";
		area.addEventListener("change", async () => {
			this.plugin.settings.art = area.value;
			await this.plugin.saveSettings();
		});
	}
}
