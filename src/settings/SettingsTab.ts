import { App, PluginSettingTab, Setting, Modal } from 'obsidian';
import type WebSocketTesterPlugin from '../../main';
import type { SavedConnection } from '../types';

export class WebSocketTesterSettingsTab extends PluginSettingTab {
    plugin: WebSocketTesterPlugin;

    constructor(app: App, plugin: WebSocketTesterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        ;

        // Saved Connections Section
        new Setting(containerEl).setName('Saved connections').setHeading();

        const connectionsContainer = containerEl.createDiv('ws-connections-list');
        this.renderConnectionsList(connectionsContainer);

        new Setting(containerEl)
            .setName('Add new connection')
            .setDesc('Save a websocket endpoint for quick access')
            .addButton(button => button
                .setButtonText('Add connection')
                .setCta()
                .onClick(() => {
                    this.showAddConnectionModal();
                }));

        // Connection Settings
        new Setting(containerEl).setName('Connection').setHeading();

        new Setting(containerEl)
            .setName('Auto-reconnect')
            .setDesc('Automatically attempt to reconnect when disconnected')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoReconnect)
                .onChange(async (value) => {
                    this.plugin.settings.autoReconnect = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Reconnect delay')
            .setDesc('Base delay in milliseconds before attempting to reconnect')
            .addText(text => text
                .setPlaceholder('1000')
                .setValue(String(this.plugin.settings.reconnectDelay))
                .onChange(async (value) => {
                    const num = parseInt(value, 10);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.reconnectDelay = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Max reconnect attempts')
            .setDesc('Maximum number of reconnection attempts before giving up')
            .addText(text => text
                .setPlaceholder('3')
                .setValue(String(this.plugin.settings.maxReconnectAttempts))
                .onChange(async (value) => {
                    const num = parseInt(value, 10);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.maxReconnectAttempts = num;
                        await this.plugin.saveSettings();
                    }
                }));

        // Display Settings
        new Setting(containerEl).setName('Display').setHeading();

        new Setting(containerEl)
            .setName('Show timestamps')
            .setDesc('Display timestamps on messages')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showTimestamps)
                .onChange(async (value) => {
                    this.plugin.settings.showTimestamps = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Timestamp format')
            .setDesc('Choose 12-hour or 24-hour time format')
            .addDropdown(dropdown => dropdown
                .addOption('12h', '12-hour')
                .addOption('24h', '24-hour')
                .setValue(this.plugin.settings.timestampFormat)
                .onChange(async (value: '12h' | '24h') => {
                    this.plugin.settings.timestampFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Font family')
            .setDesc('Font family for the message log')
            .addText(text => text
                .setPlaceholder('Monospace')
                .setValue(this.plugin.settings.fontFamily)
                .onChange(async (value) => {
                    this.plugin.settings.fontFamily = value || 'monospace';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Font size')
            .setDesc('Font size in pixels')
            .addText(text => text
                .setPlaceholder('13')
                .setValue(String(this.plugin.settings.fontSize))
                .onChange(async (value) => {
                    const num = parseInt(value, 10);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.fontSize = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Max messages')
            .setDesc('Maximum number of messages to keep in the log')
            .addText(text => text
                .setPlaceholder('500')
                .setValue(String(this.plugin.settings.maxMessages))
                .onChange(async (value) => {
                    const num = parseInt(value, 10);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.maxMessages = num;
                        await this.plugin.saveSettings();
                    }
                }));
    }

    private renderConnectionsList(container: HTMLElement): void {
        container.empty();

        if (this.plugin.settings.savedConnections.length === 0) {
            container.createEl('p', {
                text: 'No saved connections. Add one below.',
                cls: 'ws-no-connections'
            });
            return;
        }

        for (const conn of this.plugin.settings.savedConnections) {
            const connEl = container.createDiv('ws-connection-item');

            const infoEl = connEl.createDiv('ws-connection-info');
            infoEl.createEl('span', { text: conn.name, cls: 'ws-connection-name' });
            infoEl.createEl('span', { text: conn.url, cls: 'ws-connection-url' });

            const actionsEl = connEl.createDiv('ws-connection-actions');

            const editBtn = actionsEl.createEl('button', { text: 'Edit' });
            editBtn.addEventListener('click', () => {
                this.showEditConnectionModal(conn);
            });

            const deleteBtn = actionsEl.createEl('button', { text: 'Delete', cls: 'mod-warning' });
            deleteBtn.addEventListener('click', () => {
                this.plugin.settings.savedConnections = this.plugin.settings.savedConnections.filter(
                    c => c.id !== conn.id
                );
                void this.plugin.saveSettings().catch((e) => {
                    console.error('Failed to save settings:', e);
                });
                this.renderConnectionsList(container);
            });
        }
    }

    private showAddConnectionModal(): void {
        const modal = new ConnectionModal(this.app, null, (conn) => {
            conn.id = this.generateId();
            this.plugin.settings.savedConnections.push(conn);
            void this.plugin.saveSettings().catch((e) => {
                console.error('Failed to save settings:', e);
            });
            this.display();
        });
        modal.open();
    }

    private showEditConnectionModal(conn: SavedConnection): void {
        const modal = new ConnectionModal(this.app, conn, (updated) => {
            const index = this.plugin.settings.savedConnections.findIndex(c => c.id === conn.id);
            if (index !== -1) {
                this.plugin.settings.savedConnections[index] = { ...updated, id: conn.id };
                void this.plugin.saveSettings().catch((e) => {
                    console.error('Failed to save settings:', e);
                });
                this.display();
            }
        });
        modal.open();
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
}

class ConnectionModal extends Modal {
    private connection: SavedConnection | null;
    private onSave: (conn: SavedConnection) => void;
    private nameInput: HTMLInputElement;
    private urlInput: HTMLInputElement;

    constructor(app: App, connection: SavedConnection | null, onSave: (conn: SavedConnection) => void) {
        super(app);
        this.connection = connection;
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        new Setting(contentEl).setName(this.connection ? 'Edit Connection' : 'Add Connection').setHeading();

        const form = contentEl.createEl('div', { cls: 'ws-connection-form' });

        // Name field
        const nameGroup = form.createDiv('ws-form-group');
        nameGroup.createEl('label', { text: 'Name' });
        this.nameInput = nameGroup.createEl('input', { type: 'text' });
        this.nameInput.placeholder = 'My websocket server';
        if (this.connection) {
            this.nameInput.value = this.connection.name;
        }

        // URL field
        const urlGroup = form.createDiv('ws-form-group');
        urlGroup.createEl('label', { text: 'Websocket address' });
        this.urlInput = urlGroup.createEl('input', { type: 'text' });
        this.urlInput.placeholder = 'wss://example.com/socket';
        if (this.connection) {
            this.urlInput.value = this.connection.url;
        }

        // Buttons
        const buttonsEl = form.createDiv('ws-form-buttons');

        const cancelBtn = buttonsEl.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = buttonsEl.createEl('button', { text: 'Save', cls: 'mod-cta' });
        saveBtn.addEventListener('click', () => {
            const name = this.nameInput.value.trim();
            const url = this.urlInput.value.trim();

            if (!name || !url) {
                return;
            }

            this.onSave({
                id: this.connection?.id || '',
                name,
                url
            });
            this.close();
        });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
