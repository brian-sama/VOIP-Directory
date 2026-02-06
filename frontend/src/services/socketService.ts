import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:5001`;

class SocketService {
    private socket: Socket | null = null;
    private listeners: Map<string, Function[]> = new Map();

    connect(userId: string, department: string, role: string) {
        if (this.socket?.connected) {
            console.log('[Socket.io] Already connected');
            return;
        }

        this.socket = io(SOCKET_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        this.socket.on('connect', () => {
            console.log('[Socket.io] Connected to server');
            this.socket?.emit('join', { userId, department, role });
        });

        this.socket.on('disconnect', () => {
            console.log('[Socket.io] Disconnected from server');
        });

        this.socket.on('connect_error', (error) => {
            console.error('[Socket.io] Connection error:', error);
        });

        // Re-attach all listeners
        this.listeners.forEach((callbacks, event) => {
            callbacks.forEach(callback => {
                this.socket?.on(event, callback);
            });
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            console.log('[Socket.io] Disconnected');
        }
    }

    on(event: string, callback: Function) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)?.push(callback);

        if (this.socket) {
            this.socket.on(event, callback as any);
        }
    }

    off(event: string, callback?: Function) {
        if (callback) {
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
            this.socket?.off(event, callback as any);
        } else {
            this.listeners.delete(event);
            this.socket?.off(event);
        }
    }

    emit(event: string, data: any) {
        this.socket?.emit(event, data);
    }

    isConnected(): boolean {
        return this.socket?.connected || false;
    }
}

export const socketService = new SocketService();
