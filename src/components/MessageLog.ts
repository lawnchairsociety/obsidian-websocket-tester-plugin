import { WebSocketMessage } from '../types';

export interface MessageLogConfig {
    maxMessages: number;
    showTimestamps: boolean;
    timestampFormat: '12h' | '24h';
    fontFamily: string;
    fontSize: number;
}

export class MessageLog {
    private container: HTMLElement;
    private config: MessageLogConfig;
    private messages: WebSocketMessage[] = [];
    private scrollToBottomBtn: HTMLButtonElement | null = null;
    private autoScroll: boolean = true;

    constructor(container: HTMLElement, config: MessageLogConfig) {
        this.container = container;
        this.config = config;
        this.setupScrollListener();
        this.applyStyles();
    }

    private setupScrollListener(): void {
        this.container.addEventListener('scroll', () => {
            this.autoScroll = this.isAtBottom();
            this.updateScrollButton();
        });
    }

    setScrollButton(button: HTMLButtonElement): void {
        this.scrollToBottomBtn = button;
        this.scrollToBottomBtn.addEventListener('click', () => {
            this.scrollToBottom();
            this.autoScroll = true;
            this.updateScrollButton();
        });
        this.updateScrollButton();
    }

    private updateScrollButton(): void {
        if (this.scrollToBottomBtn) {
            this.scrollToBottomBtn.toggleClass('ws-hidden', this.autoScroll);
        }
    }

    private formatTimestamp(date: Date): string {
        if (this.config.timestampFormat === '12h') {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        }
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    private formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    private tryFormatJson(content: string): { formatted: string; isJson: boolean } {
        try {
            const parsed = JSON.parse(content);
            return {
                formatted: JSON.stringify(parsed, null, 2),
                isJson: true
            };
        } catch {
            return { formatted: content, isJson: false };
        }
    }

    addMessage(message: WebSocketMessage): void {
        this.messages.push(message);
        this.renderMessage(message);
        this.trimMessages();

        if (this.autoScroll) {
            this.scrollToBottom();
        }
    }

    private renderMessage(message: WebSocketMessage): void {
        const messageEl = this.container.createDiv({
            cls: `ws-message ws-message-${message.direction}`
        });

        // Header row with direction indicator, timestamp, and size
        const headerEl = messageEl.createDiv('ws-message-header');

        const directionEl = headerEl.createSpan('ws-message-direction');
        directionEl.setText(message.direction === 'sent' ? '↑ SENT' : '↓ RECEIVED');

        if (this.config.showTimestamps) {
            const timestampEl = headerEl.createSpan('ws-message-timestamp');
            timestampEl.setText(this.formatTimestamp(message.timestamp));
        }

        const sizeEl = headerEl.createSpan('ws-message-size');
        sizeEl.setText(this.formatSize(message.size));

        // Message content
        const contentEl = messageEl.createDiv('ws-message-content');
        const { formatted, isJson } = this.tryFormatJson(message.content);

        if (isJson) {
            contentEl.addClass('ws-message-json');
        }

        const preEl = contentEl.createEl('pre');
        preEl.setText(formatted);
    }

    addSystemMessage(text: string, type: 'info' | 'error' | 'success' = 'info'): void {
        const messageEl = this.container.createDiv({
            cls: `ws-message ws-message-system ws-message-system-${type}`
        });

        const contentEl = messageEl.createDiv('ws-message-content');
        contentEl.setText(text);

        if (this.autoScroll) {
            this.scrollToBottom();
        }
    }

    private trimMessages(): void {
        while (this.messages.length > this.config.maxMessages) {
            this.messages.shift();
            if (this.container.firstChild) {
                this.container.removeChild(this.container.firstChild);
            }
        }
    }

    clear(): void {
        this.container.empty();
        this.messages = [];
    }

    scrollToBottom(): void {
        this.container.scrollTop = this.container.scrollHeight;
    }

    isAtBottom(): boolean {
        const threshold = 50;
        return (this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight) < threshold;
    }

    updateConfig(config: Partial<MessageLogConfig>): void {
        this.config = { ...this.config, ...config };
        this.applyStyles();
    }

    applyStyles(): void {
        this.container.style.fontFamily = this.config.fontFamily;
        this.container.style.fontSize = `${this.config.fontSize}px`;
    }

    getMessages(): WebSocketMessage[] {
        return [...this.messages];
    }

    getMessageCount(): number {
        return this.messages.length;
    }
}
