import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

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

const ActivityPage = () => {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchActivities();
    }, []);

    const fetchActivities = async () => {
        try {
            const { data } = await api.get('/activity');
            setActivities(data);
        } catch (err) {
            console.error('Failed to fetch activities', err);
            setError('Failed to fetch activity logs');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container">
            <div className="page-header">
                <h1>Activity Logs</h1>
                <p className="text-muted">Track all user actions and system events</p>
            </div>

            <div className="card">
                <div className="card-header flex justify-between align-center">
                    <h2>Recent Activity</h2>
                    <button className="btn btn-cerulean btn-sm" onClick={fetchActivities}>
                        Refresh
                    </button>
                </div>

                <div style={{ padding: '16px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <div className="spinner" style={{ margin: '0 auto', borderTopColor: 'var(--primary)' }}></div>
                            <p className="text-muted" style={{ marginTop: '12px' }}>Loading activities...</p>
                        </div>
                    ) : error ? (
                        <div className="text-danger text-center" style={{ padding: '40px' }}>
                            {error}
                        </div>
                    ) : activities.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)' }}>
                            <h3>No activity yet</h3>
                            <p>Actions like adding users, editing records, and exports will appear here.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {activities.map((activity) => (
                                <div
                                    key={activity.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '16px',
                                        padding: '16px',
                                        background: '#f9fafb',
                                        borderRadius: '10px',
                                        borderLeft: `4px solid ${getActionColor(activity.action)}`
                                    }}
                                >
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                            {activity.action}
                                        </div>
                                        {activity.details && (
                                            <div style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '4px' }}>
                                                {activity.details}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--muted)' }}>
                                            <span>User: {activity.user_name || 'System'}</span>
                                            <span title={activity.created_at}>Time: {getRelativeTime(activity.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActivityPage;
