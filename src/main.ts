import { Plugin, WorkspaceLeaf, WorkspaceSplit, debounce } from "obsidian";
import { DEFAULT_SETTINGS, MotdSettingTab, MotdSettings } from "./settings";
import { MotdView, VIEW_TYPE_MOTD } from "./view";

export default class MotdPlugin extends Plugin {
	settings: MotdSettings = DEFAULT_SETTINGS;
	private ensuring = false;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.registerView(VIEW_TYPE_MOTD, (leaf) => new MotdView(leaf, this));
		this.addSettingTab(new MotdSettingTab(this.app, this));

		this.addCommand({
			id: "open",
			name: "Open dashboard",
			callback: () => this.ensureDashboard(true),
		});

		this.app.workspace.onLayoutReady(async () => {
			await this.ensureDashboard(this.settings.showOnStartup);
			// Bring the pinned tab back if it's closed.
			this.registerEvent(
				this.app.workspace.on(
					"layout-change",
					debounce(() => {
						if (this.settings.keepOpen) this.ensureDashboard(false);
					}, 300, true)
				)
			);
		});
	}

	/** Make sure exactly one pinned dashboard tab exists, first in the main tab group. */
	async ensureDashboard(reveal: boolean): Promise<void> {
		if (this.ensuring) return;
		this.ensuring = true;
		try {
			const { workspace } = this.app;
			const [existing, ...extras] = workspace.getLeavesOfType(VIEW_TYPE_MOTD);
			extras.forEach((leaf) => leaf.detach());

			let leaf = existing;
			if (!leaf) {
				leaf = this.placeLeaf();
				await leaf.setViewState({ type: VIEW_TYPE_MOTD, active: false });
			}
			leaf.setPinned(true);
			if (reveal) {
				await workspace.revealLeaf(leaf);
				workspace.setActiveLeaf(leaf, { focus: true });
			}
		} finally {
			this.ensuring = false;
		}
	}

	/** Reuse an empty tab if there is one, otherwise open a new tab at the front of the main area. */
	private placeLeaf(): WorkspaceLeaf {
		const { workspace } = this.app;
		let empty: WorkspaceLeaf | null = null;
		let firstGroup: WorkspaceLeaf["parent"] | null = null;
		workspace.iterateRootLeaves((leaf) => {
			firstGroup ??= leaf.parent;
			if (!empty && leaf.view.getViewType() === "empty") empty = leaf;
		});
		if (empty) return empty;
		// The first tab group is a WorkspaceTabs, which createLeafInParent accepts at runtime.
		if (firstGroup) return workspace.createLeafInParent(firstGroup as unknown as WorkspaceSplit, 0);
		return workspace.getLeaf("tab");
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_MOTD)) {
			if (leaf.view instanceof MotdView) leaf.view.render();
		}
	}
}
