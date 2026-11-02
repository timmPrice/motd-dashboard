import { App, ItemView, Modal, Notice, Platform, Setting, TFile, WorkspaceLeaf, normalizePath, setIcon } from "obsidian";
import type MotdPlugin from "./main";

export const VIEW_TYPE_MOTD = "motd-view";

interface Action {
	key: string;
	icon: string;
	label: string;
	hint?: string;
	run: () => void | Promise<void>;
}

// Obsidian's plugin registry isn't in the public typings.
interface PluginRegistry {
	enabledPlugins: Set<string>;
	manifests: Record<string, unknown>;
}

export class MotdView extends ItemView {
	private resizeObserver: ResizeObserver | null = null;

	constructor(leaf: WorkspaceLeaf, private plugin: MotdPlugin) {
		super(leaf);
		this.navigation = false;
	}

	getViewType(): string {
		return VIEW_TYPE_MOTD;
	}

	getDisplayText(): string {
		return "motd";
	}

	getIcon(): string {
		return "terminal-square";
	}

	async onOpen(): Promise<void> {
		this.contentEl.tabIndex = -1;
		this.registerDomEvent(this.contentEl, "keydown", (evt) => this.onKey(evt));
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf === this.leaf) {
					this.render();
					this.contentEl.focus();
				}
			})
		);
		this.render();
	}

	async onClose(): Promise<void> {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
	}

	render(): void {
		this.resizeObserver?.disconnect();
		const root = this.contentEl;
		root.empty();
		root.addClass("motd-view");

		const container = root.createDiv("motd-container");

		const artWrap = container.createDiv("motd-art-wrap");
		const art = artWrap.createEl("pre", { cls: "motd-art", text: normalizeArt(this.plugin.settings.art) });
		this.resizeObserver = new ResizeObserver(() => fitArt(artWrap, art));
		this.resizeObserver.observe(artWrap);

		const menu = container.createDiv("motd-menu");
		for (const action of this.actions()) {
			const row = menu.createDiv("motd-row");
			setIcon(row.createSpan("motd-row-icon"), action.icon);
			const label = row.createSpan({ cls: "motd-row-label", text: action.label });
			if (action.hint) label.createSpan({ cls: "motd-row-hint", text: action.hint });
			row.createSpan({ cls: "motd-row-key", text: `[${action.key}]` });
			row.addEventListener("click", () => action.run());
		}

		const plugins = this.pluginRegistry();
		if (plugins) {
			const total = Object.keys(plugins.manifests).length;
			container.createDiv({
				cls: "motd-footer",
				text: `Obsidian loaded ${plugins.enabledPlugins.size}/${total} plugins`,
			});
		}
	}

	private onKey(evt: KeyboardEvent): void {
		if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
		const action = this.actions().find((a) => a.key === evt.key);
		if (!action) return;
		evt.preventDefault();
		action.run();
	}

	private actions(): Action[] {
		const recent = this.recentFile();
		const actions: Action[] = [
			{ key: "f", icon: "search", label: "Find file", run: () => this.findFile() },
			{ key: "d", icon: "calendar-days", label: "Daily note", run: () => this.command("daily-notes") },
			{ key: "n", icon: "file-plus", label: "New note", run: () => this.command("file-explorer:new-file") },
			{ key: "N", icon: "folder-plus", label: "New folder", run: () => new NewFolderModal(this.app).open() },
			{
				key: "r",
				icon: "history",
				label: "Recent file",
				hint: recent?.basename,
				run: () => {
					if (recent) this.app.workspace.getLeaf(false).openFile(recent);
					else new Notice("No recent files");
				},
			},
		];
		if (Platform.isDesktopApp) {
			actions.push({ key: "q", icon: "log-out", label: "Quit", run: () => window.close() });
		}
		return actions;
	}

	private findFile(): void {
		const omnisearch = this.pluginRegistry()?.enabledPlugins.has("omnisearch");
		this.command(omnisearch ? "omnisearch:show-modal" : "switcher:open");
	}

	private command(id: string): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ok = (this.app as any).commands.executeCommandById(id);
		if (!ok) new Notice(`motd: command "${id}" isn't available`);
	}

	private recentFile(): TFile | null {
		for (const path of this.app.workspace.getLastOpenFiles()) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) return file;
		}
		return null;
	}

	private pluginRegistry(): PluginRegistry | null {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return (this.app as any).plugins ?? null;
	}
}

function normalizeArt(art: string): string {
	return art
		.replace(/\t/g, "    ")
		.replace(/^(\s*\n)+/, "")
		.replace(/\s+$/, "");
}

// Shrink the art's font size (never wrap) so the whole piece fits the pane.
function fitArt(wrap: HTMLElement, art: HTMLElement): void {
	art.style.fontSize = "";
	const available = wrap.clientWidth;
	const natural = art.scrollWidth;
	if (natural > available && available > 0) {
		const base = parseFloat(getComputedStyle(art).fontSize);
		art.style.fontSize = `${Math.floor(base * (available / natural) * 100) / 100}px`;
	}
}

class NewFolderModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText("New folder");
		let name = "";
		const submit = async () => {
			const path = normalizePath(name.trim());
			if (!path) return;
			try {
				await this.app.vault.createFolder(path);
				new Notice(`Created ${path}/`);
				this.close();
			} catch (e) {
				new Notice(`Couldn't create ${path}: ${(e as Error).message}`);
			}
		};
		new Setting(this.contentEl).setName("Path").addText((t) => {
			t.setPlaceholder("Flotsam/new-folder").onChange((v) => (name = v));
			t.inputEl.addEventListener("keydown", (evt) => {
				if (evt.key === "Enter") submit();
			});
			window.setTimeout(() => t.inputEl.focus(), 0);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
