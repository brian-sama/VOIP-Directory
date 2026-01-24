import React from 'react';
import { DeviceStatus } from '../types';

interface StatusBadgeProps {
    status: DeviceStatus | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const isOnline = status === DeviceStatus.ONLINE || status === 'Online' || status === 'OK';
    const isPending = status === DeviceStatus.PENDING || status === 'Pinging...';

    const styles = isOnline
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : isPending
            ? 'bg-amber-100 text-amber-700 border-amber-200 animate-pulse'
            : 'bg-rose-100 text-rose-700 border-rose-200';

    const dotColor = isOnline ? 'bg-emerald-500' : isPending ? 'bg-amber-500' : 'bg-rose-500';

    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border inline-flex items-center gap-1.5 ${styles}`}>
            <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
            {status}
        </span>
    );
};
