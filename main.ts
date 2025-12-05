import { Plugin } from 'obsidian';
import { WebSocketTesterSettings, DEFAULT_SETTINGS, ConnectionStatus } from './src/types';
import { VIEW_TYPE_WEBSOCKET_TESTER } from './src/constants';
import { WebSocketTesterSettingsTab } from './src/settings/SettingsTab';
import { WebSocketTesterView } from './src/views/WebSocketTesterView';

export default class WebSocketTesterPlugin extends Plugin {
    settings: WebSocketTesterSettings;
    private statusBarEl: HTMLElement;

    async onload(): Promise<void> {
        await this.loadSettings();

        // Register the view
        this.registerView(
            VIEW_TYPE_WEBSOCKET_TESTER,
            (leaf) => new WebSocketTesterView(leaf, this)
        );

        // Add ribbon icon
        this.addRibbonIcon('plug', 'Open WebSocket Tester', () => {
            this.activateView();
        });

        // Add status bar item
        this.statusBarEl = this.addStatusBarItem();
        this.updateStatusBar('disconnected');

        // Add command to open tester
        this.addCommand({
            id: 'open-websocket-tester',
            name: 'Open WebSocket Tester',
            callback: () => {
                this.activateView();
            }
        });

        // Add command to disconnect
        this.addCommand({
            id: 'websocket-disconnect',
            name: 'Disconnect WebSocket',
            callback: () => {
                const view = this.getView();
                if (view) {
                    view.disconnect();
                }
            }
        });

        // Add command to clear log
        this.addCommand({
            id: 'websocket-clear-log',
            name: 'Clear WebSocket message log',
            callback: () => {
                const view = this.getView();
                if (view) {
                    view.clearLog();
                }
            }
        });

        // Add settings tab
        this.addSettingTab(new WebSocketTesterSettingsTab(this.app, this));
    }

    onunload(): void {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_WEBSOCKET_TESTER);
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        // Notify view to refresh
        const view = this.getView();
        if (view) {
            view.refreshSettings();
        }
    }

    async activateView(): Promise<void> {
        const { workspace } = this.app;

        let leaf = workspace.getLeavesOfType(VIEW_TYPE_WEBSOCKET_TESTER)[0];

        if (!leaf) {
            leaf = workspace.getLeaf('tab');
            await leaf.setViewState({
                type: VIEW_TYPE_WEBSOCKET_TESTER,
                active: true
            });
        }

        workspace.revealLeaf(leaf);
    }

    updateStatusBar(status: ConnectionStatus): void {
        const statusText: Record<ConnectionStatus, string> = {
            disconnected: 'WS: Offline',
            connecting: 'WS: Connecting...',
            connected: 'WS: Connected',
            error: 'WS: Error'
        };

        this.statusBarEl.setText(statusText[status]);
    }

    getView(): WebSocketTesterView | null {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WEBSOCKET_TESTER);
        if (leaves.length > 0) {
            return leaves[0].view as WebSocketTesterView;
        }
        return null;
    }
}
