import React from 'react';
import { Phone, CheckCircle, XCircle, Building2 } from 'lucide-react';
import { SystemStats } from '../types';

interface DashboardCardsProps {
    stats: SystemStats;
}

export const DashboardCards: React.FC<DashboardCardsProps> = ({ stats }) => {
    const items = [
        { label: 'Total Extensions', value: stats.totalExtensions, icon: Phone, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Active Online', value: stats.onlineCount, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Currently Offline', value: stats.offlineCount, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
        { label: 'Departments', value: stats.departments, icon: Building2, color: 'text-slate-600', bg: 'bg-slate-50' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {items.map((item, idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 text-sm font-medium mb-1">{item.label}</p>
                            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{item.value}</h3>
                        </div>
                        <div className={`${item.bg} p-3.5 rounded-xl`}>
                            <item.icon className={`w-6 h-6 ${item.color}`} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
