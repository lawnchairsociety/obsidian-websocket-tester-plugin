export interface SavedConnection {
    id: string;
    name: string;
    url: string;
}

export interface WebSocketTesterSettings {
    savedConnections: SavedConnection[];
    lastConnectionId: string;
    autoReconnect: boolean;
    reconnectDelay: number;
    maxReconnectAttempts: number;
    fontFamily: string;
    fontSize: number;
    maxMessages: number;
    showTimestamps: boolean;
    timestampFormat: '12h' | '24h';
}

export const DEFAULT_SETTINGS: WebSocketTesterSettings = {
    savedConnections: [],
    lastConnectionId: '',
    autoReconnect: false,
    reconnectDelay: 1000,
    maxReconnectAttempts: 3,
    fontFamily: 'monospace',
    fontSize: 13,
    maxMessages: 500,
    showTimestamps: true,
    timestampFormat: '24h',
};

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionState {
    status: ConnectionStatus;
    connectionName?: string;
    error?: string;
}

export type MessageDirection = 'sent' | 'received';

export interface WebSocketMessage {
    id: string;
    direction: MessageDirection;
    content: string;
    timestamp: Date;
    size: number;
}
