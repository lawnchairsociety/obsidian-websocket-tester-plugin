import { ItemView, WorkspaceLeaf, Modal, App } from 'obsidian';
import { VIEW_TYPE_WEBSOCKET_TESTER } from '../constants';
import type WebSocketTesterPlugin from '../../main';
import type { ConnectionState, SavedConnection, WebSocketMessage } from '../types';
import { MessageLog } from '../components/MessageLog';
import { MessageComposer } from '../components/MessageComposer';
import { WebSocketService } from '../services/WebSocketService';

export class WebSocketTesterView extends ItemView {
    plugin: WebSocketTesterPlugin;
    private connectionState: ConnectionState = { status: 'disconnected' };
    private webSocket: WebSocketService;

    // UI Elements
    private connectionDropdown: HTMLSelectElement;
    private urlInput: HTMLInputElement;
    private connectBtn: HTMLButtonElement;
    private saveBtn: HTMLButtonElement;
    private statusEl: HTMLElement;
    private clearBtn: HTMLButtonElement;
    private messageCountEl: HTMLElement;

    // Components
    private messageLog: MessageLog;
    private messageComposer: MessageComposer;

    constructor(leaf: WorkspaceLeaf, plugin: WebSocketTesterPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.initWebSocket();
    }

    private initWebSocket(): void {
        this.webSocket = new WebSocketService(
            {
                onOpen: () => {
                    this.connectionState = {
                        status: 'connected',
                        connectionName: this.getConnectionNameForUrl(this.urlInput.value)
                    };
                    this.messageLog.addSystemMessage('Connected', 'success');
                    this.updateConnectionUI();

                    // Save last used connection
                    const selectedId = this.connectionDropdown.value;
                    if (selectedId) {
                        this.plugin.settings.lastConnectionId = selectedId;
                        void this.plugin.saveSettings().catch((e) => {
                            console.error('Failed to save settings:', e);
                        });
                    }
                },
                onClose: (code, reason) => {
                    const wasConnected = this.connectionState.status === 'connected';
                    this.connectionState = { status: 'disconnected' };

                    if (wasConnected) {
                        const reasonText = reason ? ` - ${reason}` : '';
                        this.messageLog.addSystemMessage(
                            `Disconnected (code: ${code})${reasonText}`,
                            'info'
                        );
                    }

                    this.updateConnectionUI();
                },
                onMessage: (data) => {
                    const message: WebSocketMessage = {
                        id: this.generateId(),
                        direction: 'received',
                        content: data,
                        timestamp: new Date(),
                        size: new Blob([data]).size
                    };
                    this.messageLog.addMessage(message);
                    this.updateMessageCount();
                },
                onError: (error) => {
                    this.connectionState = {
                        status: 'error',
                        error: error
                    };
                    this.messageLog.addSystemMessage(`Error: ${error}`, 'error');
                    this.updateConnectionUI();
                },
                onStatusChange: (status) => {
                    if (status === 'connecting' && this.connectionState.status !== 'connecting') {
                        this.connectionState = { status: 'connecting' };
                        this.messageLog.addSystemMessage('Reconnecting...', 'info');
                        this.updateConnectionUI();
                    }
                }
            },
            {
                autoReconnect: this.plugin.settings.autoReconnect,
                reconnectDelay: this.plugin.settings.reconnectDelay,
                maxReconnectAttempts: this.plugin.settings.maxReconnectAttempts
            }
        );
    }

    getViewType(): string {
        return VIEW_TYPE_WEBSOCKET_TESTER;
    }

    getDisplayText(): string {
        return 'Websocket tester';
    }

    getIcon(): string {
        return 'plug';
    }

    async onOpen(): Promise<void> {
        await super.onOpen();
        const container = this.contentEl;
        container.empty();
        container.addClass('ws-tester-container');

        this.buildUI();
        this.updateConnectionDropdown();
        this.updateConnectionUI();
    }

    async onClose(): Promise<void> {
        await super.onClose();
        this.webSocket.destroy();
    }

    private buildUI(): void {
        // Connection panel
        const connectionPanel = this.contentEl.createDiv('ws-connection-panel');

        // URL row
        const urlRow = connectionPanel.createDiv('ws-connection-row');

        this.connectionDropdown = urlRow.createEl('select', { cls: 'ws-connection-dropdown' });
        this.connectionDropdown.addEventListener('change', () => {
            const selectedId = this.connectionDropdown.value;
            if (selectedId) {
                const conn = this.plugin.settings.savedConnections.find(c => c.id === selectedId);
                if (conn) {
                    this.urlInput.value = conn.url;
                }
            }
        });

        this.urlInput = urlRow.createEl('input', {
            type: 'text',
            cls: 'ws-url-input',
            placeholder: 'ws://localhost:8080 or wss://example.com/socket'
        });

        this.connectBtn = urlRow.createEl('button', {
            text: 'Connect',
            cls: 'ws-connect-btn'
        });
        this.connectBtn.addEventListener('click', () => {
            this.handleConnectClick();
        });

        // Status row
        const statusRow = connectionPanel.createDiv('ws-connection-row ws-status-row');

        this.statusEl = statusRow.createDiv('ws-status');
        this.statusEl.setText('Disconnected');

        this.saveBtn = statusRow.createEl('button', {
            text: 'Save connection',
            cls: 'ws-save-btn ws-hidden'
        });
        this.saveBtn.addEventListener('click', () => {
            this.handleSaveConnection();
        });

        // Message log wrapper
        const logWrapper = this.contentEl.createDiv('ws-log-wrapper');

        // Log header with clear and count
        const logHeader = logWrapper.createDiv('ws-log-header');

        const logTitle = logHeader.createSpan('ws-log-title');
        logTitle.setText('Messages');

        this.messageCountEl = logHeader.createSpan('ws-message-count');
        this.messageCountEl.setText('0 messages');

        this.clearBtn = logHeader.createEl('button', {
            text: 'Clear',
            cls: 'ws-clear-btn'
        });
        this.clearBtn.addEventListener('click', () => {
            this.clearLog();
        });

        // Message log
        const logContainer = logWrapper.createDiv('ws-log-container');
        this.messageLog = new MessageLog(logContainer, {
            maxMessages: this.plugin.settings.maxMessages,
            showTimestamps: this.plugin.settings.showTimestamps,
            timestampFormat: this.plugin.settings.timestampFormat,
            fontFamily: this.plugin.settings.fontFamily,
            fontSize: this.plugin.settings.fontSize
        });

        // Scroll to bottom button
        const scrollBtn = logWrapper.createEl('button', {
            text: '↓ scroll to bottom',
            cls: 'ws-scroll-btn'
        });
        this.messageLog.setScrollButton(scrollBtn);

        // Message composer panel
        const composerPanel = this.contentEl.createDiv('ws-composer-panel');

        const composerLabel = composerPanel.createDiv('ws-composer-label');
        composerLabel.setText('Message');

        const composerRow = composerPanel.createDiv('ws-composer-row');

        const textarea = composerRow.createEl('textarea', {
            cls: 'ws-message-textarea',
            placeholder: 'Enter message to send...'
        });

        const sendBtn = composerRow.createEl('button', {
            text: 'Send',
            cls: 'ws-send-btn'
        });

        this.messageComposer = new MessageComposer(textarea, sendBtn, {
            onSend: (message) => {
                this.handleSendMessage(message);
            }
        });
    }

    private updateConnectionDropdown(): void {
        this.connectionDropdown.empty();

        this.connectionDropdown.createEl('option', {
            text: 'Select a connection',
            value: ''
        });

        for (const conn of this.plugin.settings.savedConnections) {
            const option = this.connectionDropdown.createEl('option', {
                text: conn.name,
                value: conn.id
            });

            if (conn.id === this.plugin.settings.lastConnectionId) {
                option.selected = true;
                this.urlInput.value = conn.url;
            }
        }
    }

    private updateConnectionUI(): void {
        const { status, connectionName, error } = this.connectionState;

        switch (status) {
            case 'disconnected':
                this.statusEl.setText('Disconnected');
                this.statusEl.className = 'ws-status ws-status-disconnected';
                this.connectBtn.setText('Connect');
                this.connectBtn.disabled = false;
                this.urlInput.disabled = false;
                this.connectionDropdown.disabled = false;
                break;
            case 'connecting':
                this.statusEl.setText('Connecting...');
                this.statusEl.className = 'ws-status ws-status-connecting';
                this.connectBtn.setText('Cancel');
                this.connectBtn.disabled = false;
                this.urlInput.disabled = true;
                this.connectionDropdown.disabled = true;
                break;
            case 'connected':
                this.statusEl.setText(`Connected${connectionName ? ` to ${connectionName}` : ''}`);
                this.statusEl.className = 'ws-status ws-status-connected';
                this.connectBtn.setText('Disconnect');
                this.connectBtn.disabled = false;
                this.urlInput.disabled = true;
                this.connectionDropdown.disabled = true;
                break;
            case 'error':
                this.statusEl.setText(`Error: ${error || 'Unknown'}`);
                this.statusEl.className = 'ws-status ws-status-error';
                this.connectBtn.setText('Connect');
                this.connectBtn.disabled = false;
                this.urlInput.disabled = false;
                this.connectionDropdown.disabled = false;
                break;
        }

        // Show save button if connected to unsaved URL
        const currentUrl = this.urlInput.value;
        const isSaved = this.plugin.settings.savedConnections.some(c => c.url === currentUrl);
        this.saveBtn.toggleClass('ws-hidden', !(status === 'connected' && !isSaved));

        // Update status bar
        this.plugin.updateStatusBar(status);
    }

    private handleConnectClick(): void {
        if (this.connectionState.status === 'connected' || this.connectionState.status === 'connecting') {
            this.webSocket.disconnect();
        } else {
            const url = this.urlInput.value.trim();
            if (!url) {
                this.messageLog.addSystemMessage('Please enter a WebSocket URL', 'error');
                return;
            }

            if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
                this.messageLog.addSystemMessage('URL must start with ws:// or wss://', 'error');
                return;
            }

            this.connectionState = { status: 'connecting' };
            this.messageLog.addSystemMessage(`Connecting to ${url}...`, 'info');
            this.updateConnectionUI();

            this.webSocket.connect(url);
        }
    }

    private handleSendMessage(message: string): void {
        if (!this.webSocket.isConnected()) {
            this.messageLog.addSystemMessage('Not connected', 'error');
            return;
        }

        if (this.webSocket.send(message)) {
            const wsMessage: WebSocketMessage = {
                id: this.generateId(),
                direction: 'sent',
                content: message,
                timestamp: new Date(),
                size: new Blob([message]).size
            };
            this.messageLog.addMessage(wsMessage);
            this.updateMessageCount();
        } else {
            this.messageLog.addSystemMessage('Failed to send message', 'error');
        }
    }

    private handleSaveConnection(): void {
        const url = this.urlInput.value.trim();
        if (!url) return;

        const modal = new SaveConnectionModal(this.app, url, (name) => {
            const newConnection: SavedConnection = {
                id: this.generateId(),
                name,
                url
            };

            this.plugin.settings.savedConnections.push(newConnection);
            this.plugin.settings.lastConnectionId = newConnection.id;
            void this.plugin.saveSettings().catch((e) => {
                console.error('Failed to save settings:', e);
            });

            this.updateConnectionDropdown();
            this.saveBtn.addClass('ws-hidden');

            this.messageLog.addSystemMessage(`Connection "${name}" saved`, 'success');
        });
        modal.open();
    }

    private getConnectionNameForUrl(url: string): string | undefined {
        const conn = this.plugin.settings.savedConnections.find(c => c.url === url);
        return conn?.name;
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    private updateMessageCount(): void {
        const count = this.messageLog.getMessageCount();
        this.messageCountEl.setText(`${count} message${count !== 1 ? 's' : ''}`);
    }

    public clearLog(): void {
        this.messageLog.clear();
        this.updateMessageCount();
    }

    public disconnect(): void {
        this.webSocket.disconnect();
    }

    public refreshSettings(): void {
        this.messageLog.updateConfig({
            maxMessages: this.plugin.settings.maxMessages,
            showTimestamps: this.plugin.settings.showTimestamps,
            timestampFormat: this.plugin.settings.timestampFormat,
            fontFamily: this.plugin.settings.fontFamily,
            fontSize: this.plugin.settings.fontSize
        });
        this.updateConnectionDropdown();

        this.webSocket.updateConfig({
            autoReconnect: this.plugin.settings.autoReconnect,
            reconnectDelay: this.plugin.settings.reconnectDelay,
            maxReconnectAttempts: this.plugin.settings.maxReconnectAttempts
        });
    }

    public focusComposer(): void {
        this.messageComposer.focus();
    }
}

class SaveConnectionModal extends Modal {
    private url: string;
    private onSave: (name: string) => void;
    private nameInput: HTMLInputElement;

    constructor(app: App, url: string, onSave: (name: string) => void) {
        super(app);
        this.url = url;
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Save connection' });

        const form = contentEl.createDiv('ws-connection-form');

        // URL display (read-only)
        const urlGroup = form.createDiv('ws-form-group');
        urlGroup.createEl('label', { text: 'URL' });
        const urlDisplay = urlGroup.createEl('input', { type: 'text', cls: 'ws-muted' });
        urlDisplay.value = this.url;
        urlDisplay.disabled = true;

        // Name field
        const nameGroup = form.createDiv('ws-form-group');
        nameGroup.createEl('label', { text: 'Name' });
        this.nameInput = nameGroup.createEl('input', { type: 'text' });
        this.nameInput.placeholder = 'My websocket server';
        this.nameInput.focus();

        // Handle Enter key
        this.nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.save();
            }
        });

        // Buttons
        const buttonsEl = form.createDiv('ws-form-buttons');

        const cancelBtn = buttonsEl.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = buttonsEl.createEl('button', { text: 'Save', cls: 'mod-cta' });
        saveBtn.addEventListener('click', () => this.save());
    }

    private save(): void {
        const name = this.nameInput.value.trim();
        if (!name) {
            this.nameInput.addClass('is-invalid');
            return;
        }

        this.onSave(name);
        this.close();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
