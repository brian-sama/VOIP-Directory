import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import axios from 'axios';

const getRelativeTime = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

const getActionColor = (action) => {
    if (!action) return '#6b7280';
    if (action.includes('Added') || action.includes('Created')) return '#38ef7d';
    if (action.includes('Updated') || action.includes('Edited')) return '#667eea';
    if (action.includes('Deleted') || action.includes('Removed')) return '#f45c43';
    if (action.includes('Login')) return '#ffd700';
    return '#6b7280';
};

const LogsPage = () => {
    const [activeTab, setActiveTab] = useState('activity');
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reportLoading, setReportLoading] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        if (activeTab === 'activity') fetchActivities();
    }, [activeTab]);

    const fetchActivities = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/activity');
            setActivities(data);
        } catch (err) {
            console.error('Failed to fetch activities', err);
        } finally {
            setLoading(false);
        }
    };

    const downloadReport = async (format, reportType) => {
        setReportLoading(`${reportType}-${format}`);
        try {
            let url = '', filename = '';
            if (reportType === 'daily') {
                url = `/api/reports/daily?date=${selectedDate}&format=${format}`;
                filename = `daily_report_${selectedDate}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
            } else {
                url = `/api/reports/range?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&format=${format}`;
                filename = `report_${dateRange.startDate}_to_${dateRange.endDate}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
            }
            const res = await api.get(url, { responseType: 'blob' });
            const downloadUrl = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            alert(`Failed to download ${format} report.`);
        } finally {
            setReportLoading(null);
        }
    };

    return (
        <div className="container">
            <div className="page-header">
                <h1>Logs & Reports</h1>
                <p className="text-muted">Monitor activity and generate downtime reports</p>
            </div>

            <div className="tabs" style={{ marginBottom: '24px' }}>
                <button className={`tab-link ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>Activity Logs</button>
                <button className={`tab-link ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>Reports</button>
            </div>

            {activeTab === 'activity' ? (
                <div className="card">
                    <div className="card-header flex justify-between align-center">
                        <h2>Recent Activity</h2>
                        <button className="btn btn-cerulean btn-sm" onClick={fetchActivities}>Refresh</button>
                    </div>
                    <div style={{ padding: '16px' }}>
                        {loading ? (
                            <div className="text-center" style={{ padding: '40px' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
                        ) : activities.length === 0 ? (
                            <div className="text-center" style={{ padding: '60px' }}><h3>No activity yet</h3></div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {activities.map((a) => (
                                    <div key={a.id} style={{ padding: '16px', background: '#f9fafb', borderRadius: '10px', borderLeft: `4px solid ${getActionColor(a.action)}` }}>
                                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{a.action}</div>
                                        {a.details && <div style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '4px' }}>{a.details}</div>}
                                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--muted)' }}>
                                            <span>User: {a.user_name || 'System'}</span>
                                            <span>{getRelativeTime(a.created_at)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="card">
                        <div className="card-header"><h2>Daily Report</h2></div>
                        <div style={{ padding: '24px' }}>
                            <p className="text-muted">Offline extensions for a specific day.</p>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Date:</label>
                                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0', width: '100%', maxWidth: '300px' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn btn-red" onClick={() => downloadReport('pdf', 'daily')} disabled={!!reportLoading}>{reportLoading === 'daily-pdf' ? '...' : 'Download PDF'}</button>
                                <button className="btn btn-complete" onClick={() => downloadReport('excel', 'daily')} disabled={!!reportLoading}>{reportLoading === 'daily-excel' ? '...' : 'Download Excel'}</button>
                            </div>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header"><h2>Range Report</h2></div>
                        <div style={{ padding: '24px' }}>
                            <p className="text-muted">Offline extensions for a date range.</p>
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Start:</label>
                                    <input type="date" value={dateRange.startDate} onChange={(e) => setDateRange(p => ({ ...p, startDate: e.target.value }))} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0', width: '100%' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>End:</label>
                                    <input type="date" value={dateRange.endDate} onChange={(e) => setDateRange(p => ({ ...p, endDate: e.target.value }))} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0', width: '100%' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn btn-red" onClick={() => downloadReport('pdf', 'range')} disabled={!!reportLoading}>{reportLoading === 'range-pdf' ? '...' : 'Download PDF'}</button>
                                <button className="btn btn-complete" onClick={() => downloadReport('excel', 'range')} disabled={!!reportLoading}>{reportLoading === 'range-excel' ? '...' : 'Download Excel'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LogsPage;
