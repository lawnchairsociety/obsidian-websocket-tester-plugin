export interface MessageComposerCallbacks {
    onSend: (message: string) => void;
}

export class MessageComposer {
    private textarea: HTMLTextAreaElement;
    private sendBtn: HTMLButtonElement;
    private history: string[] = [];
    private historyIndex: number = -1;
    private currentInput: string = '';
    private callbacks: MessageComposerCallbacks;

    constructor(
        textarea: HTMLTextAreaElement,
        sendBtn: HTMLButtonElement,
        callbacks: MessageComposerCallbacks
    ) {
        this.textarea = textarea;
        this.sendBtn = sendBtn;
        this.callbacks = callbacks;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Send button click
        this.sendBtn.addEventListener('click', () => {
            this.handleSend();
        });

        // Keyboard shortcuts
        this.textarea.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter to send
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.handleSend();
                return;
            }

            // Arrow up/down for history (only when at start/end of input)
            if (e.key === 'ArrowUp' && this.isAtStart()) {
                e.preventDefault();
                this.navigateHistory(-1);
            } else if (e.key === 'ArrowDown' && this.isAtEnd()) {
                e.preventDefault();
                this.navigateHistory(1);
            }
        });
    }

    private isAtStart(): boolean {
        return this.textarea.selectionStart === 0 && this.textarea.selectionEnd === 0;
    }

    private isAtEnd(): boolean {
        const len = this.textarea.value.length;
        return this.textarea.selectionStart === len && this.textarea.selectionEnd === len;
    }

    private handleSend(): void {
        const message = this.textarea.value;

        if (!message.trim()) {
            return;
        }

        // Add to history if not empty and not duplicate of last
        if (this.history.length === 0 || this.history[this.history.length - 1] !== message) {
            this.history.push(message);
        }

        // Reset history navigation
        this.historyIndex = -1;
        this.currentInput = '';

        // Clear textarea
        this.textarea.value = '';

        // Trigger callback
        this.callbacks.onSend(message);

        // Refocus textarea
        this.textarea.focus();
    }

    private navigateHistory(direction: number): void {
        if (this.history.length === 0) return;

        // Save current input when starting navigation
        if (this.historyIndex === -1 && direction === -1) {
            this.currentInput = this.textarea.value;
        }

        const newIndex = this.historyIndex + direction;

        if (direction === -1) {
            // Going back in history
            if (newIndex >= -1 && newIndex < this.history.length) {
                this.historyIndex = newIndex;
                if (this.historyIndex === -1) {
                    this.textarea.value = this.currentInput;
                } else {
                    this.textarea.value = this.history[this.history.length - 1 - this.historyIndex];
                }
            }
        } else {
            // Going forward in history
            if (this.historyIndex > -1) {
                this.historyIndex = newIndex;
                if (this.historyIndex === -1) {
                    this.textarea.value = this.currentInput;
                } else {
                    this.textarea.value = this.history[this.history.length - 1 - this.historyIndex];
                }
            }
        }
    }

    focus(): void {
        this.textarea.focus();
    }

    setValue(value: string): void {
        this.textarea.value = value;
    }

    getValue(): string {
        return this.textarea.value;
    }

    setEnabled(enabled: boolean): void {
        this.textarea.disabled = !enabled;
        this.sendBtn.disabled = !enabled;
    }

    clearHistory(): void {
        this.history = [];
        this.historyIndex = -1;
        this.currentInput = '';
    }

    getHistory(): string[] {
        return [...this.history];
    }
}
