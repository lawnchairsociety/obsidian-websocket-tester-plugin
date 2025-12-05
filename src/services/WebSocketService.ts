import { ConnectionStatus } from '../types';

export interface WebSocketCallbacks {
    onOpen: () => void;
    onClose: (code: number, reason: string) => void;
    onMessage: (data: string) => void;
    onError: (error: string) => void;
    onStatusChange: (status: ConnectionStatus) => void;
}

export interface WebSocketConfig {
    autoReconnect: boolean;
    reconnectDelay: number;
    maxReconnectAttempts: number;
}

export class WebSocketService {
    private socket: WebSocket | null = null;
    private callbacks: WebSocketCallbacks;
    private config: WebSocketConfig;
    private currentUrl: string = '';
    private reconnectAttempts: number = 0;
    private reconnectTimer: number | null = null;
    private status: ConnectionStatus = 'disconnected';
    private manualDisconnect: boolean = false;

    constructor(callbacks: WebSocketCallbacks, config: WebSocketConfig) {
        this.callbacks = callbacks;
        this.config = config;
    }

    /**
     * Connect to a WebSocket server
     */
    connect(url: string): void {
        if (this.socket && this.status !== 'disconnected') {
            this.disconnect();
        }

        this.currentUrl = url;
        this.manualDisconnect = false;
        this.reconnectAttempts = 0;
        this.setStatus('connecting');

        try {
            this.socket = new WebSocket(url);
            this.setupSocketHandlers();
        } catch (error) {
            this.setStatus('error');
            this.callbacks.onError(`Failed to create WebSocket: ${error}`);
        }
    }

    /**
     * Disconnect from the current server
     */
    disconnect(): void {
        this.manualDisconnect = true;
        this.clearReconnectTimer();

        if (this.socket) {
            this.socket.close(1000, 'User disconnected');
            this.socket = null;
        }

        this.setStatus('disconnected');
    }

    /**
     * Send a message to the server
     */
    send(message: string): boolean {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return false;
        }

        try {
            this.socket.send(message);
            return true;
        } catch (error) {
            this.callbacks.onError(`Failed to send message: ${error}`);
            return false;
        }
    }

    /**
     * Get current connection status
     */
    getStatus(): ConnectionStatus {
        return this.status;
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.status === 'connected' && this.socket?.readyState === WebSocket.OPEN;
    }

    /**
     * Get the current URL
     */
    getCurrentUrl(): string {
        return this.currentUrl;
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<WebSocketConfig>): void {
        this.config = { ...this.config, ...config };
    }

    private setupSocketHandlers(): void {
        if (!this.socket) return;

        this.socket.onopen = () => {
            this.setStatus('connected');
            this.reconnectAttempts = 0;
            this.callbacks.onOpen();
        };

        this.socket.onclose = (event) => {
            const wasConnected = this.status === 'connected';
            this.setStatus('disconnected');
            this.callbacks.onClose(event.code, event.reason);

            // Attempt reconnection if appropriate
            if (!this.manualDisconnect && wasConnected && this.config.autoReconnect) {
                this.attemptReconnect();
            }
        };

        this.socket.onmessage = (event) => {
            if (typeof event.data === 'string') {
                this.callbacks.onMessage(event.data);
            }
        };

        this.socket.onerror = () => {
            this.setStatus('error');
            this.callbacks.onError('WebSocket connection error');
        };
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            this.callbacks.onError(`Failed to reconnect after ${this.config.maxReconnectAttempts} attempts`);
            return;
        }

        this.reconnectAttempts++;

        // Exponential backoff
        const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        this.callbacks.onStatusChange('connecting');

        this.reconnectTimer = window.setTimeout(() => {
            if (!this.manualDisconnect) {
                this.connect(this.currentUrl);
            }
        }, delay);
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimer !== null) {
            window.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    private setStatus(status: ConnectionStatus): void {
        this.status = status;
        this.callbacks.onStatusChange(status);
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        this.disconnect();
        this.clearReconnectTimer();
    }
}
