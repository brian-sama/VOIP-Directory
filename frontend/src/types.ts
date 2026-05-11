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
  email?: string;
    extension_number: string;
    old_extension_number?: string;
    department: string;
    section: string;
    station: string;
    office_number?: string;
    designation?: string;
    ip_address: string;
    mac_address: string;
    phone_model?: string;
    status: DeviceStatus | string;
    sip_status?: string;
    sip_port_open?: boolean | number | null;
    last_seen: string;
    role?: UserRole | string;
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
