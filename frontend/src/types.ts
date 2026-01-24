export enum UserRole {
    ADMIN = 'admin',
    USER = 'user'
}

export enum DeviceStatus {
    ONLINE = 'Online',
    OFFLINE = 'Offline',
    PENDING = 'Pinging...'
}

export interface VoipUser {
    id: number;
    name_surname: string;
    extension_number: string;
    department: string;
    section: string;
    station: string;
    ip_address: string;
    mac_address: string;
    status: DeviceStatus | string;
    last_seen: string;
}

export interface ActivityLog {
    id: number;
    created_at: string;
    action: string;
    user_name: string;
    details: string;
}

export interface SystemStats {
    totalExtensions: number;
    onlineCount: number;
    offlineCount: number;
    departments: number;
}
